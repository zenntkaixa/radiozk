import { describe, expect, it, vi } from 'vitest';
import { BARS, barLevels, ensureGraph } from '../src/visualizer.ts';

describe('barLevels', () => {
  it('returns one level per bar, scaled to 0..1, taking the loudest bin of each group', () => {
    const data = new Uint8Array(128);
    data[1] = 255;
    data[100] = 51;
    const levels = barLevels(data);
    expect(levels).toHaveLength(BARS);
    expect(levels[0]).toBe(1);
    expect(Math.max(...levels.slice(1))).toBeCloseTo(0.2);
    expect(levels.every((l) => l >= 0 && l <= 1)).toBe(true);
  });

  it('is silent for silence, and ignores the DC bin', () => {
    const data = new Uint8Array(128);
    data[0] = 255;
    expect(barLevels(data).every((l) => l === 0)).toBe(true);
  });

  it('still gives every bar a bin when there are fewer bins than bars', () => {
    expect(barLevels(new Uint8Array(16).fill(255), 32)).toHaveLength(32);
  });
});

// The reason ensureGraph exists: wrapping the element while the context is suspended mutes the stream for good.
function fakeCtx(state: 'running' | 'suspended', resumes: boolean) {
  const node = () => ({ connect: vi.fn(), fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 128 });
  const ctx = {
    state,
    destination: {} as AudioDestinationNode,
    resume: vi.fn(async () => {
      if (resumes) ctx.state = 'running';
      else await new Promise(() => {}); // never settles, like resume() without a user gesture
    }),
    close: vi.fn(async () => {}),
    createAnalyser: vi.fn(() => node()),
    createMediaElementSource: vi.fn(() => node()),
  };
  return ctx;
}
const asCtx = (c: ReturnType<typeof fakeCtx>) => () => c as never;

describe('ensureGraph', () => {
  it('does not touch the element while the context stays suspended, and closes the context', async () => {
    const ctx = fakeCtx('suspended', false);
    expect(await ensureGraph(document.createElement('audio'), asCtx(ctx), 5)).toBeNull();
    expect(ctx.createMediaElementSource).not.toHaveBeenCalled();
    expect(ctx.close).toHaveBeenCalled();
  });

  it('wires the element through the analyser to the output once the context is running', async () => {
    const ctx = fakeCtx('suspended', true);
    const graph = await ensureGraph(document.createElement('audio'), asCtx(ctx), 5);
    expect(graph).not.toBeNull();
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
    const source = ctx.createMediaElementSource.mock.results[0].value;
    expect(source.connect).toHaveBeenCalledWith(graph!.analyser);
    expect((graph!.analyser as unknown as { connect: ReturnType<typeof vi.fn> }).connect).toHaveBeenCalledWith(ctx.destination);
  });

  it('wraps an element only once, however often it is asked', async () => {
    const ctx = fakeCtx('running', true);
    const audio = document.createElement('audio');
    const first = await ensureGraph(audio, asCtx(ctx), 5);
    const second = await ensureGraph(audio, asCtx(fakeCtx('running', true)), 5);
    expect(second).toBe(first);
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
  });
});
