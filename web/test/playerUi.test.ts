import { describe, expect, it } from 'vitest';
import { MIN_LISTENERS_SHOWN, isPlayPauseKey, pageTitle, presenceLine, searchUrl, splitTitle } from '../src/playerUi.ts';

const key = (target: Element | null, over: Partial<{ code: string; repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) =>
  ({ code: 'Space', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target, ...over });
const el = (html: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild as Element;
};

describe('isPlayPauseKey', () => {
  it('toggles on Space from the page and from a range slider (which ignores Space)', () => {
    expect(isPlayPauseKey(key(document.body))).toBe(true);
    expect(isPlayPauseKey(key(el('<input type="range">')))).toBe(true);
  });

  it.each(['<button>x</button>', '<a href="#">x</a>', '<input type="radio">', '<input type="checkbox">', '<input type="text">', '<textarea></textarea>', '<select></select>', '<div contenteditable="true"></div>'])(
    'leaves Space to %s',
    (html) => expect(isPlayPauseKey(key(el(html)))).toBe(false),
  );

  it('ignores a held key, other keys and shortcuts', () => {
    expect(isPlayPauseKey(key(document.body, { repeat: true }))).toBe(false);
    expect(isPlayPauseKey(key(document.body, { code: 'Enter' }))).toBe(false);
    for (const mod of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey'] as const) expect(isPlayPauseKey(key(document.body, { [mod]: true }))).toBe(false);
  });

  it('copes with no target', () => {
    expect(isPlayPauseKey(key(null))).toBe(true);
  });
});

describe('pageTitle', () => {
  it('shows the track while playing and the page title otherwise', () => {
    expect(pageTitle('radiozk: lossless live radio', true, { title: 'Human (Clean)' })).toBe('Human (Clean) · radiozk');
    expect(pageTitle('base', false, { title: 'Human' })).toBe('base');
    expect(pageTitle('base', true, null)).toBe('base');
    expect(pageTitle('base', true, { title: '' })).toBe('base');
  });
});

describe('presenceLine', () => {
  it('shows the count from the threshold up, and only the thank-you below it or while unknown', () => {
    expect(presenceLine(MIN_LISTENERS_SHOWN)).toBe(`🎧 ${MIN_LISTENERS_SHOWN} listening with you right now · Arigatou for tuning in ✨`);
    expect(presenceLine(MIN_LISTENERS_SHOWN - 1)).toBe('Arigatou for tuning in ✨');
    expect(presenceLine(0)).toBe('Arigatou for tuning in ✨');
    expect(presenceLine(null)).toBe('Arigatou for tuning in ✨');
  });
});

describe('searchUrl', () => {
  it('builds a YouTube search with the artist and title encoded', () => {
    const url = new URL(searchUrl('Guns & Roses', 'Sweet Child o\' Mine'));
    expect(url.origin + url.pathname).toBe('https://www.youtube.com/results');
    expect(url.searchParams.get('search_query')).toBe("Guns & Roses Sweet Child o' Mine");
  });

  it('works without an artist', () => {
    expect(new URL(searchUrl('', 'Song')).searchParams.get('search_query')).toBe('Song');
  });
});

describe('splitTitle', () => {
  it.each([
    ['Policy of Truth (2006 Remaster)', 'Policy of Truth', '2006 Remaster'],
    ['Sweet Jane (Full Length Version; 2015 Remaster)', 'Sweet Jane', 'Full Length Version; 2015 Remaster'],
    ['Kiss You Back (Single Version)', 'Kiss You Back', 'Single Version'],
    ['Song [Remastered 2003]', 'Song', 'Remastered 2003'],
    ['Song (Soundtrack Album Version)', 'Song', 'Soundtrack Album Version'],
    ['Shout out to My Ex - Workout Mix', 'Shout out to My Ex', 'Workout Mix'],
    ['Song (Album Version) (2011 Remaster)', 'Song', 'Album Version · 2011 Remaster'],
  ])('moves the version note of %s under the title', (title, main, extra) => expect(splitTitle(title)).toEqual({ main, extra }));

  it.each([
    'Plain Title',
    'Folsom Prison Blues (Live at Folsom State Prison, Folsom, CA - January 1968)',
    'Lean On (feat. Someone)',
    'Song (Remix)',
    'Song (Acoustic Version)',
    'Hello - Goodbye',
    'Mixed Feelings',
  ])('leaves %s alone', (title) => expect(splitTitle(title)).toEqual({ main: title, extra: '' }));

  it('never strips a title to nothing', () => {
    expect(splitTitle('(2015 Remaster)')).toEqual({ main: '(2015 Remaster)', extra: '' });
  });
});
