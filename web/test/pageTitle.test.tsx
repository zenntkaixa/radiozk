import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { BASE_TITLE, setPlayingTitle, useDocumentTitle } from '../src/pageTitle.ts';

describe('tab title', () => {
  it('shows the page title while the page is mounted, and the base title after', () => {
    const { unmount } = renderHook(() => useDocumentTitle('About · radiozk'));
    expect(document.title).toBe('About · radiozk');
    unmount();
    expect(document.title).toBe(BASE_TITLE);
  });

  it('the playing track wins over the page title, on any page, and gives way when it stops', () => {
    const { unmount } = renderHook(() => useDocumentTitle('About · radiozk'));
    setPlayingTitle('Song · radiozk');
    expect(document.title).toBe('Song · radiozk');
    setPlayingTitle(null);
    expect(document.title).toBe('About · radiozk');
    unmount();
  });

  it('a page change while playing keeps the track title', () => {
    setPlayingTitle('Song · radiozk');
    const { unmount } = renderHook(() => useDocumentTitle('About · radiozk'));
    expect(document.title).toBe('Song · radiozk');
    unmount();
    expect(document.title).toBe('Song · radiozk');
    setPlayingTitle(null);
    expect(document.title).toBe(BASE_TITLE);
  });
});
