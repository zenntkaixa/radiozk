// Pure unit tests: no server, no database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { norm, trackKey, parseTrackRequest, isRatingValue, MAX_ARTIST, MAX_TITLE } from '../src/validate.js';

const ID = '123e4567-e89b-42d3-a456-426614174000';

test('norm collapses whitespace and tolerates non-strings', () => {
  assert.equal(norm('  Pink \t Floyd\n'), 'Pink Floyd');
  assert.equal(norm(undefined), '');
  assert.equal(norm(null), '');
  assert.equal(norm(42), '42');
});

test('trackKey ignores case and stray whitespace', () => {
  assert.equal(trackKey(' The  Beatles', 'Help! '), 'the beatles|help!');
  assert.equal(trackKey('THE BEATLES', 'help!'), trackKey('the beatles', ' Help!'));
});

test('trackKey keeps differently-titled releases distinct', () => {
  assert.notEqual(trackKey('Queen', 'Bohemian Rhapsody'), trackKey('Queen', 'Bohemian Rhapsody (2011 Remaster)'));
});

test('trackKey handles unicode', () => {
  assert.equal(trackKey('Björk', 'Jóga'), 'björk|jóga');
  assert.equal(trackKey('ÉTIENNE', 'Été'), 'étienne|été');
});

test('trackKey separates artist from title unambiguously enough for empty artists', () => {
  assert.equal(trackKey('', 'Song'), '|song');
});

test('parseTrackRequest accepts a valid request', () => {
  assert.deepEqual(parseTrackRequest(ID, { artist: ' A ', title: ' T ' }), {
    listener: ID,
    artist: 'A',
    title: 'T',
    key: 'a|t',
  });
});

test('parseTrackRequest accepts an empty artist but not an empty title', () => {
  assert.ok(!parseTrackRequest(ID, { title: 'T' }).error);
  assert.ok(parseTrackRequest(ID, { artist: 'A', title: '   ' }).error);
  assert.ok(parseTrackRequest(ID, undefined).error);
});

test('parseTrackRequest rejects missing or malformed listener ids', () => {
  for (const bad of [undefined, '', 'nope', ID.slice(1), `${ID}0`, `${ID}\n`]) {
    assert.match(parseTrackRequest(bad, { artist: 'A', title: 'T' }).error, /X-Listener-Id/, JSON.stringify(bad));
  }
  assert.ok(!parseTrackRequest(ID.toUpperCase(), { artist: 'A', title: 'T' }).error);
});

test('parseTrackRequest enforces length limits after normalising', () => {
  assert.ok(!parseTrackRequest(ID, { artist: 'a'.repeat(MAX_ARTIST), title: 't'.repeat(MAX_TITLE) }).error);
  assert.ok(parseTrackRequest(ID, { artist: 'a'.repeat(MAX_ARTIST + 1), title: 'T' }).error);
  assert.ok(parseTrackRequest(ID, { artist: 'A', title: 't'.repeat(MAX_TITLE + 1) }).error);
  // padding whitespace does not count towards the limit
  assert.ok(!parseTrackRequest(ID, { artist: ` ${'a'.repeat(MAX_ARTIST)} `, title: 'T' }).error);
});

test('isRatingValue accepts only 1, -1 and 0', () => {
  for (const ok of [1, -1, 0]) assert.ok(isRatingValue(ok));
  for (const bad of ['1', 2, -2, 0.5, null, undefined, true, NaN, [1]]) assert.ok(!isRatingValue(bad), String(bad));
});
