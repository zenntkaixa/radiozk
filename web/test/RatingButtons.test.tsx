import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RatingButtons from '../src/components/RatingButtons.tsx';
import * as api from '../src/api.ts';

vi.mock('../src/api.ts');
const getRatings = vi.mocked(api.getRatings);
const setRating = vi.mocked(api.setRating);

type Summary = api.RatingSummary;

/** A promise the test resolves/rejects by hand, to observe the in-flight state. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

const up = () => screen.getByRole('button', { name: 'I like this track' });
const down = () => screen.getByRole('button', { name: "I don't like this track" });

async function renderLoaded(initial: Summary, track = { artist: 'A', title: 'T' }) {
  getRatings.mockResolvedValue(initial);
  const view = render(<RatingButtons {...track} />);
  await waitFor(() => expect(up()).toBeEnabled());
  return view;
}

beforeEach(() => vi.resetAllMocks());

describe('RatingButtons', () => {
  it('shows placeholders and disabled buttons until the counts load', async () => {
    const d = deferred<Summary>();
    getRatings.mockReturnValue(d.promise);
    render(<RatingButtons artist="A" title="T" />);
    expect(up()).toBeDisabled();
    expect(up()).toHaveTextContent('–');
    d.resolve({ up: 3, down: 1, mine: 0 });
    await waitFor(() => expect(up()).toHaveTextContent('3'));
    expect(down()).toHaveTextContent('1');
    expect(up()).toBeEnabled();
  });

  it('loads the ratings for the given track', async () => {
    await renderLoaded({ up: 0, down: 0, mine: 0 }, { artist: 'Queen', title: 'Radio Ga Ga' });
    expect(getRatings).toHaveBeenCalledWith('Queen', 'Radio Ga Ga');
  });

  it('marks the listener\'s existing vote as pressed', async () => {
    await renderLoaded({ up: 2, down: 5, mine: -1 });
    expect(down()).toHaveAttribute('aria-pressed', 'true');
    expect(up()).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies a vote optimistically, then adopts the server counts', async () => {
    const d = deferred<Summary>();
    setRating.mockReturnValue(d.promise);
    await renderLoaded({ up: 2, down: 1, mine: 0 });

    await userEvent.click(up());
    expect(setRating).toHaveBeenCalledWith('A', 'T', 1);
    expect(up()).toHaveTextContent('3'); // before the server answers
    expect(up()).toHaveAttribute('aria-pressed', 'true');

    d.resolve({ up: 9, down: 1, mine: 1 }); // server is authoritative
    await waitFor(() => expect(up()).toHaveTextContent('9'));
  });

  it('disables both buttons while a save is in flight', async () => {
    const d = deferred<Summary>();
    setRating.mockReturnValue(d.promise);
    await renderLoaded({ up: 0, down: 0, mine: 0 });

    await userEvent.click(up());
    expect(up()).toBeDisabled();
    expect(down()).toBeDisabled();
    d.resolve({ up: 1, down: 0, mine: 1 });
    await waitFor(() => expect(down()).toBeEnabled());
  });

  it('moves a vote from up to down', async () => {
    setRating.mockResolvedValue({ up: 1, down: 2, mine: -1 });
    await renderLoaded({ up: 2, down: 1, mine: 1 });
    await userEvent.click(down());
    expect(setRating).toHaveBeenCalledWith('A', 'T', -1);
    await waitFor(() => expect(down()).toHaveAttribute('aria-pressed', 'true'));
    expect(up()).toHaveTextContent('1');
    expect(down()).toHaveTextContent('2');
  });

  it('clears the vote when tapping the current one', async () => {
    setRating.mockResolvedValue({ up: 1, down: 0, mine: 0 });
    await renderLoaded({ up: 2, down: 0, mine: 1 });
    await userEvent.click(up());
    expect(setRating).toHaveBeenCalledWith('A', 'T', 0);
    await waitFor(() => expect(up()).toHaveAttribute('aria-pressed', 'false'));
    expect(up()).toHaveTextContent('1');
  });

  it('rolls back and shows an alert when saving fails', async () => {
    setRating.mockRejectedValue(new Error('nope'));
    await renderLoaded({ up: 2, down: 1, mine: 0 });
    await userEvent.click(up());
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save your rating.");
    expect(up()).toHaveTextContent('2');
    expect(up()).toHaveAttribute('aria-pressed', 'false');
    expect(up()).toBeEnabled();
  });

  it('clears the alert on the next attempt', async () => {
    setRating.mockRejectedValueOnce(new Error('nope')).mockResolvedValueOnce({ up: 3, down: 1, mine: 1 });
    await renderLoaded({ up: 2, down: 1, mine: 0 });
    await userEvent.click(up());
    await screen.findByRole('alert');
    await userEvent.click(up());
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(up()).toHaveTextContent('3');
  });

  it('shows an alert when the initial load fails and keeps the buttons disabled', async () => {
    getRatings.mockRejectedValue(new Error('down'));
    render(<RatingButtons artist="A" title="T" />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(up()).toBeDisabled();
  });

  it('ignores a save response that arrives after the track changed', async () => {
    const save = deferred<Summary>();
    setRating.mockReturnValue(save.promise);
    const { rerender } = await renderLoaded({ up: 1, down: 0, mine: 0 });
    await userEvent.click(up());

    getRatings.mockResolvedValue({ up: 40, down: 0, mine: 0 });
    rerender(<RatingButtons artist="B" title="U" />);
    await waitFor(() => expect(up()).toHaveTextContent('40'));

    save.resolve({ up: 99, down: 99, mine: 1 }); // belongs to the previous track
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(up()).toHaveTextContent('40');
    expect(up()).toHaveAttribute('aria-pressed', 'false');
  });

  it('ignores a slow load for a previous track', async () => {
    const slow = deferred<Summary>();
    getRatings.mockReturnValueOnce(slow.promise);
    const { rerender } = render(<RatingButtons artist="A" title="T" />);
    getRatings.mockResolvedValueOnce({ up: 7, down: 0, mine: 0 });
    rerender(<RatingButtons artist="B" title="U" />);
    await waitFor(() => expect(up()).toHaveTextContent('7'));

    slow.resolve({ up: 55, down: 0, mine: 0 });
    await new Promise((r) => setTimeout(r, 0));
    expect(up()).toHaveTextContent('7');
  });
});
