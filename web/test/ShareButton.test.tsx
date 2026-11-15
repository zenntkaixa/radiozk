import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareButton from '../src/components/ShareButton.tsx';

const setNav = (share: unknown, writeText?: unknown) => {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  Object.defineProperty(navigator, 'clipboard', { value: writeText ? { writeText } : undefined, configurable: true });
};
afterEach(() => setNav(undefined));
const click = () => userEvent.click(screen.getByRole('button', { name: 'Share' }));

describe('ShareButton', () => {
  it('opens the share sheet with the site link where it exists', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNav(share);
    render(<ShareButton />);
    await click();
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: `${location.origin}/` }));
  });

  it('stays quiet when the sheet is closed, and copies when sharing fails or is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNav(vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')), writeText);
    const view = render(<ShareButton />);
    await click();
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText('Link copied')).toBeNull();
    view.unmount();

    setNav(vi.fn().mockRejectedValue(new Error('denied')), writeText);
    render(<ShareButton />);
    await click();
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/`);
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });

  it('shows the link when even copying is not possible', async () => {
    setNav(undefined, vi.fn().mockRejectedValue(new Error('blocked')));
    render(<ShareButton />);
    await click();
    expect(await screen.findByText(/Copy this link: /)).toBeInTheDocument();
  });
});
