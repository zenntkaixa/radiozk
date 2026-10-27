// Run: npm test (in web/). Node strips the TypeScript types from the imported module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/nowPlaying.ts';

// A real response from metadatav2.json, including the stray whitespace seen in the feed.
const feed = {
  bit_depth: 16,
  sample_rate: 44100,
  artist: 'Depeche Mode',
  title: 'Policy of Truth  (2006 Remaster)',
  album: 'Violator ',
  date: '1990',
  prev_artist_1: 'The Raconteurs',
  prev_title_1: 'Help Me Stranger',
  prev_artist_2: 'The Velvet Underground',
  prev_title_2: 'Sweet Jane   (Full Length Version; 2015 Remaster)',
  is_new: false,
  is_summer: false,
  is_vidgames: false,
};

test('maps the current track and trims/collapses whitespace', () => {
  const np = parse(feed);
  assert.equal(np.artist, 'Depeche Mode');
  assert.equal(np.title, 'Policy of Truth (2006 Remaster)');
  assert.equal(np.album, 'Violator');
  assert.equal(np.year, '1990');
});

test('reads bit depth and sample rate as numbers', () => {
  const np = parse(feed);
  assert.equal(np.bitDepth, 16);
  assert.equal(np.sampleRate, 44100);
});

test('collects previous tracks in order, cleaning their titles', () => {
  assert.deepEqual(parse(feed).previous, [
    { artist: 'The Raconteurs', title: 'Help Me Stranger' },
    { artist: 'The Velvet Underground', title: 'Sweet Jane (Full Length Version; 2015 Remaster)' },
  ]);
});

test('skips empty previous slots but keeps entries that have only one of artist/title', () => {
  const np = parse({ ...feed, prev_artist_3: '', prev_title_3: '', prev_artist_4: 'Only Artist', prev_title_4: '' });
  assert.equal(np.previous.length, 3);
  assert.deepEqual(np.previous[2], { artist: 'Only Artist', title: '' });
});

test('reads at most five previous tracks', () => {
  const raw = { ...feed };
  for (let i = 1; i <= 8; i++) {
    raw[`prev_artist_${i}`] = `A${i}`;
    raw[`prev_title_${i}`] = `T${i}`;
  }
  assert.equal(parse(raw).previous.length, 5);
});

test('cover URL changes with the track so the browser does not reuse a cached cover', () => {
  const a = parse(feed).coverUrl;
  const b = parse({ ...feed, title: 'Another Song' }).coverUrl;
  assert.match(a, /^https:\/\/d3d4yli4hf5bmh\.cloudfront\.net\/cover\.jpg\?t=/);
  assert.notEqual(a, b);
  assert.equal(a, parse({ ...feed, album: 'Different Album' }).coverUrl, 'album alone does not change the key');
});

test('tolerates missing and wrongly-typed fields', () => {
  const np = parse({ title: 5, artist: null, bit_depth: 'x', sample_rate: NaN, album: ['a'] });
  assert.equal(np.title, '');
  assert.equal(np.artist, '');
  assert.equal(np.album, '');
  assert.equal(np.bitDepth, null);
  assert.equal(np.sampleRate, null);
  assert.deepEqual(np.previous, []);
});

test('does not treat the is_* flags as part of the track', () => {
  assert.equal('is_new' in parse(feed), false);
});
