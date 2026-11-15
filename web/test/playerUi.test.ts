import { describe, expect, it } from 'vitest';
import { isPlayPauseKey, pageTitle } from '../src/playerUi.ts';

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
