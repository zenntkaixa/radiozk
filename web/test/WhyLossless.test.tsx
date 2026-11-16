import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WhyLossless from '../src/components/WhyLossless.tsx';

describe('WhyLossless', () => {
  it('starts collapsed and opens on click', async () => {
    const { container } = render(<WhyLossless />);
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    await userEvent.click(screen.getByText('Why lossless?'));
    expect(details.open).toBe(true);
    expect(screen.getByText(/bit for bit/)).toBeInTheDocument();
  });
});
