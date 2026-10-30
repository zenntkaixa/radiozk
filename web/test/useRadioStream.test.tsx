// The playback hook with a fake hls.js: what is loaded when, and how Play, quality switches and unmounts behave.
// The library and the idle scheduler are mocked; real playback is covered by the Playwright e2e script.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  factoryRuns: 0,
  gate: null as Promise<void> | null,
  failImport: false,
  saveData: false,
  idle: [] as { fn: () => void; cancelled: boolean }[],
  instances: [] as FakeHlsInstance[],
}));

interface FakeHlsInstance {
  handlers: Record<string, (...a: unknown[]) => void>;
  levels: { audioCodec: string }[];
  currentLevel: number;
  loadSource: ReturnType<typeof vi.fn>;
  attachMedia: ReturnType<typeof vi.fn>;
  startLoad: ReturnType<typeof vi.fn>;
  stopLoad: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  recoverMediaError: ReturnType<typeof vi.fn>;
}

// Registered per test with vi.doMock (see setup): Vitest caches a vi.mock factory's result across resetModules().
const hlsFactory = async () => {
  h.factoryRuns++;
  if (h.gate) await h.gate;
  if (h.failImport) throw new Error('chunk failed to load');
  class FakeHls {
    static Events = { MANIFEST_PARSED: 'manifest', LEVEL_SWITCHED: 'level', ERROR: 'error' };
    static ErrorTypes = { NETWORK_ERROR: 'network', MEDIA_ERROR: 'media' };
    static isSupported = () => true;
    handlers: FakeHlsInstance['handlers'] = {};
    levels = [{ audioCodec: 'flac' }, { audioCodec: 'mp4a.40.2' }];
    currentLevel = -1;
    loadSource = vi.fn();
    attachMedia = vi.fn();
    startLoad = vi.fn();
    stopLoad = vi.fn();
    destroy = vi.fn();
    recoverMediaError = vi.fn();
    constructor() {
      h.instances.push(this as unknown as FakeHlsInstance);
    }
    on(event: string, cb: (...a: unknown[]) => void) {
      this.handlers[event] = cb;
    }
  }
  return { default: FakeHls };
};

vi.mock('../src/idle.ts', () => ({
  whenIdle: (fn: () => void) => {
    const entry = { fn, cancelled: false };
    h.idle.push(entry);
    return () => {
      entry.cancelled = true;
    };
  },
  saveDataRequested: () => h.saveData,
}));

type Hook = ReturnType<typeof import('../src/hooks/useRadioStream.ts').useRadioStream>;

/** Loads fresh copies of React, Testing Library and the hook: the hook caches the loaded library at module level. */
async function setup() {
  vi.resetModules();
  vi.doMock('hls.js/light', hlsFactory);
  const rtl = await import('@testing-library/react');
  const React = await import('react');
  const { useRadioStream } = await import('../src/hooks/useRadioStream.ts');
  let latest!: Hook;
  function Harness() {
    latest = useRadioStream();
    return React.createElement('audio', { ref: latest.audioRef, ...latest.audioProps });
  }
  const view = rtl.render(React.createElement(Harness));
  const audio = () => view.container.querySelector('audio') as HTMLAudioElement;
  const runIdle = () => h.idle.filter((i) => !i.cancelled).forEach((i) => i.fn());
  const built = () => rtl.waitFor(() => expect(h.instances.length).toBeGreaterThan(0));
  mounted.push(view);
  return { rtl, view, get hook() { return latest; }, audio, runIdle, built };
}

const mounted: { unmount: () => void }[] = [];
const play = vi.fn();

beforeEach(() => {
  Object.assign(h, { factoryRuns: 0, gate: null, failImport: false, saveData: false, idle: [], instances: [] });
  vi.stubGlobal('MediaSource', { isTypeSupported: () => true });
  play.mockReset().mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
});
afterEach(() => {
  mounted.splice(0).forEach((v) => v.unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useRadioStream: loading', () => {
  it('loads nothing until the page is idle, then builds the player without fetching media', async () => {
    const t = await setup();
    expect(h.factoryRuns).toBe(0);
    expect(h.idle).toHaveLength(1);

    t.runIdle();
    await t.built();
    const hls = h.instances[0];
    expect(hls.loadSource).toHaveBeenCalledWith(expect.stringContaining('/hls/live.m3u8'));
    expect(hls.attachMedia).toHaveBeenCalledWith(t.audio());
    expect(hls.startLoad).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('never loads the library in native HLS mode (Safari/iOS)', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe');
    vi.spyOn(navigator, 'vendor', 'get').mockReturnValue('Apple Computer, Inc.');
    const t = await setup();
    expect(t.hook.mode).toBe('native');
    expect(h.idle).toHaveLength(0);
    expect(h.factoryRuns).toBe(0);
  });

  it('skips the background load when the user asked to save data, and builds on Play instead', async () => {
    h.saveData = true;
    const t = await setup();
    expect(h.idle).toHaveLength(0);
    t.rtl.act(() => t.hook.togglePlay());
    await t.built();
    expect(h.instances).toHaveLength(1);
  });

  it('reports an error, and builds nothing, when the library fails to load', async () => {
    h.failImport = true;
    const t = await setup();
    t.rtl.act(() => t.hook.togglePlay());
    await t.rtl.waitFor(() => expect(t.hook.status).toBe('error'));
    expect(t.hook.notice).toMatch(/couldn't load the audio player/i);
    expect(h.instances).toHaveLength(0);
  });

  it('retries the load on the next Play after a failure', async () => {
    h.failImport = true;
    const t = await setup();
    t.rtl.act(() => t.hook.togglePlay());
    await t.rtl.waitFor(() => expect(t.hook.status).toBe('error'));

    h.failImport = false;
    t.rtl.act(() => t.hook.togglePlay());
    await t.built();
    t.rtl.act(() => h.instances[0].handlers.manifest());
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('builds nothing if the component unmounts while the library is still loading', async () => {
    let release!: () => void;
    h.gate = new Promise<void>((r) => (release = r));
    const t = await setup();
    t.rtl.act(() => t.hook.togglePlay());
    t.view.unmount();
    release();
    await new Promise((r) => setTimeout(r, 20));
    expect(h.instances).toHaveLength(0);
    expect(play).not.toHaveBeenCalled();
  });
});

describe('useRadioStream: Play', () => {
  it('starts straight away when the player is already built', async () => {
    const t = await setup();
    t.runIdle();
    await t.built();
    t.rtl.act(() => t.hook.togglePlay());
    expect(h.instances).toHaveLength(1);
    expect(h.instances[0].startLoad).toHaveBeenCalledWith(-1);
    expect(play).toHaveBeenCalledTimes(1); // synchronous, inside the click's user activation
    expect(t.hook.status).toBe('buffering');
  });

  it('pressed before the player exists: builds now and starts once the manifest is parsed, on the FLAC level', async () => {
    const t = await setup();
    t.rtl.act(() => t.hook.togglePlay());
    expect(t.hook.status).toBe('buffering');
    await t.built();
    expect(h.instances[0].startLoad).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();

    t.rtl.act(() => h.instances[0].handlers.manifest());
    expect(h.instances[0].currentLevel).toBe(0);
    expect(h.instances[0].startLoad).toHaveBeenCalledWith(-1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('pressed twice before the player is ready cancels the start', async () => {
    const t = await setup();
    t.rtl.act(() => t.hook.togglePlay());
    t.rtl.act(() => t.hook.togglePlay());
    expect(t.hook.status).toBe('idle');
    await t.built();
    t.rtl.act(() => h.instances[0].handlers.manifest());
    expect(play).not.toHaveBeenCalled();
    expect(h.instances[0].startLoad).not.toHaveBeenCalled();
  });

  it('tells the listener when the browser cannot decode FLAC and falls back to the AAC level', async () => {
    const t = await setup();
    t.runIdle();
    await t.built();
    h.instances[0].levels = [{ audioCodec: 'mp4a.40.2' }];
    t.rtl.act(() => h.instances[0].handlers.manifest());
    expect(t.hook.notice).toMatch(/can't decode FLAC/i);
    expect(h.instances[0].currentLevel).toBe(-1); // left to hls.js: the only level is AAC
  });
});

describe('useRadioStream: quality switch', () => {
  it('while paused: destroys the old player at once and rebuilds in the background', async () => {
    const t = await setup();
    t.runIdle();
    await t.built();
    t.rtl.act(() => t.hook.changeQuality('aac'));
    expect(h.instances[0].destroy).toHaveBeenCalled();
    expect(h.instances).toHaveLength(1);

    t.runIdle();
    await t.rtl.waitFor(() => expect(h.instances).toHaveLength(2));
    t.rtl.act(() => h.instances[1].handlers.manifest());
    expect(h.instances[1].currentLevel).toBe(1); // the AAC level
    expect(play).not.toHaveBeenCalled(); // it was not playing, so it does not start
  });

  it('after Play was pressed but before the player was ready: rebuilds at once, still starts, on the new level', async () => {
    const t = await setup();
    t.rtl.act(() => t.hook.togglePlay()); // waiting for the library
    t.rtl.act(() => t.hook.changeQuality('aac')); // no idle callback has run, and none should be needed
    await t.built();
    expect(h.instances).toHaveLength(1); // the superseded build was dropped
    t.rtl.act(() => h.instances[0].handlers.manifest());
    expect(h.instances[0].currentLevel).toBe(1);
    expect(h.instances[0].startLoad).toHaveBeenCalledWith(-1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('while playing: rebuilds immediately and resumes on the new level', async () => {
    const t = await setup();
    t.runIdle();
    await t.built();
    Object.defineProperty(t.audio(), 'paused', { value: false, configurable: true });
    t.rtl.act(() => t.hook.changeQuality('aac'));
    await t.rtl.waitFor(() => expect(h.instances).toHaveLength(2)); // no idle callback needed
    t.rtl.act(() => h.instances[1].handlers.manifest());
    expect(h.instances[1].currentLevel).toBe(1);
    expect(h.instances[1].startLoad).toHaveBeenCalledWith(-1);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
