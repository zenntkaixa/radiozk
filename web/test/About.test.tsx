import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import About from '../src/pages/About.tsx';

const setup = () => render(<MemoryRouter><About /></MemoryRouter>);

describe('About', () => {
  it('keeps "About" as the only h1 and no other heading containing it (the e2e matches by substring)', () => {
    setup();
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['About']);
    for (const h of screen.getAllByRole('heading', { level: 2 })) expect(h.textContent).not.toMatch(/about/i);
  });

  it('gives each section its own card heading', () => {
    setup();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['📻The story', "🎧What you're hearing", '🛠️Under the hood', '👋Say hi']);
  });

  it('shows the stack as pills', () => {
    setup();
    const pills = screen.getByRole('list').querySelectorAll('li');
    expect([...pills].map((li) => li.textContent)).toEqual(expect.arrayContaining(['React', 'Vite', 'Express', 'PostgreSQL', 'Render']));
  });

  it('offers GitHub, LinkedIn and Portfolio as safe external links', () => {
    setup();
    for (const [name, host] of [['GitHub', 'github.com'], ['LinkedIn', 'linkedin.com'], ['Portfolio', 'zenntkaixa.dev']]) {
      const a = screen.getByRole('link', { name });
      expect(a.getAttribute('href')).toContain(host);
      expect(a).toHaveAttribute('target', '_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
  });

  it('credits Radio Calico and ends with a way back to the player', () => {
    setup();
    expect(screen.getAllByRole('link', { name: 'Radio Calico' })[0]).toHaveAttribute('href', 'https://www.radio-calico.com/');
    expect(screen.getByRole('link', { name: /Back to the radio/ })).toHaveAttribute('href', '/');
  });

  it('sets the tab title while shown and restores the base title when left', () => {
    document.title = 'base';
    const { unmount } = setup();
    expect(document.title).toBe('About · radiozk');
    unmount();
    expect(document.title).not.toBe('About · radiozk');
  });
});
