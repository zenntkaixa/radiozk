import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import NotFound from '../src/pages/NotFound.tsx';

describe('NotFound', () => {
  it('says so, with a friendly line and a way back to the radio', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing but static/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to the radio/ })).toHaveAttribute('href', '/');
    expect(document.title).toBe('Page not found · radiozk');
  });
});
