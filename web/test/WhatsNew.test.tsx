import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import WhatsNew from '../src/pages/WhatsNew.tsx';
import { CHANGELOG } from '../src/changelog.ts';

describe("What's new", () => {
  it('lists every release, newest first, with a heading per release', () => {
    render(<MemoryRouter><WhatsNew /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: "What's new" })).toBeInTheDocument();
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(CHANGELOG.map((r) => r.title));
    expect(document.title).toBe("What's new · radiozk");
  });

  it('keeps dates in order and every entry non-empty', () => {
    const dates = CHANGELOG.map((r) => r.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(new Set(CHANGELOG.map((r) => r.title)).size).toBe(CHANGELOG.length); // titles are React keys
    for (const r of CHANGELOG) expect(r.items.length).toBeGreaterThan(0);
  });

  it('goes back to the radio with the same button as the other pages', () => {
    render(<MemoryRouter><WhatsNew /></MemoryRouter>);
    const back = screen.getByRole('link', { name: /Back to the radio/ });
    expect(back).toHaveAttribute('href', '/');
    expect(back.className).toContain('bg-indigo-600');
  });
});
