// Frequency bars for the player, from a Web Audio AnalyserNode. A lazy chunk: the page never loads it until
// something is playing through hls.js (Safari's native HLS can't be tapped and never gets here).
//
// One hazard shapes this file: createMediaElementSource() re-routes the element's sound through the audio
// graph for good. If the context is suspended at that moment (no user gesture yet), the stream goes silent. So
// the graph is only built once the context is really running; otherwise there is no visualizer and the audio is
// left alone.

export const BARS = 32;
const COLOR = '#6366f1'; // indigo-500: readable on both the light and the dark card

type Ctx = Pick<AudioContext, 'state' | 'resume' | 'close' | 'createAnalyser' | 'createMediaElementSource' | 'destination'> &
  Partial<Pick<AudioContext, 'addEventListener'>>;

export interface Graph {
  ctx: Ctx;
  analyser: AnalyserNode;
}

// An element can be wrapped only once, so the graph lives as long as the element.
const graphs = new WeakMap<HTMLMediaElement, Graph>();

/** Collapses FFT bins into `bars` levels (0..1), spaced on a log scale so bass and treble get similar room. */
export function barLevels(data: Uint8Array, bars = BARS): number[] {
  const levels: number[] = [];
  let from = 1; // bin 0 is DC
  for (let i = 0; i < bars; i++) {
    const to = Math.min(data.length, Math.max(from + 1, Math.round(data.length ** ((i + 1) / bars))));
    let max = 0;
    for (let k = from; k < to; k++) max = Math.max(max, data[k]);
    levels.push(max / 255);
    from = to;
  }
  return levels;
}

/** The audio graph for `audio`, or null when the context isn't running (see the note at the top). */
export async function ensureGraph(audio: HTMLMediaElement, makeCtx: () => Ctx = () => new AudioContext(), waitMs = 400): Promise<Graph | null> {
  const have = graphs.get(audio);
  if (have) {
    if (have.ctx.state === 'suspended') void have.ctx.resume().catch(() => {});
    return have;
  }
  const ctx = makeCtx();
  if (ctx.state !== 'running') {
    // resume() may never settle without a user gesture, so don't wait for it forever
    await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, waitMs))]);
  }
  if (ctx.state !== 'running') {
    void ctx.close().catch(() => {});
    return null;
  }
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  const source = ctx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(ctx.destination);
  // A suspended context after this point would mute the stream, so keep it running.
  ctx.addEventListener?.('statechange', () => {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  });
  const graph = { ctx, analyser };
  graphs.set(audio, graph);
  return graph;
}

function paint(canvas: HTMLCanvasElement, levels: number[]) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, w, h);
  g.fillStyle = COLOR;
  const slot = w / levels.length;
  const bar = Math.max(1, slot * 0.6);
  levels.forEach((l, i) => {
    const bh = Math.max(2 * dpr, l * h);
    g.fillRect(i * slot + (slot - bar) / 2, h - bh, bar, bh);
  });
}

/** Draws the bars until the returned function is called, which also clears the canvas. Null if there is no graph. */
export async function startVisualizer(audio: HTMLMediaElement, canvas: HTMLCanvasElement): Promise<(() => void) | null> {
  const graph = await ensureGraph(audio);
  if (!graph) return null;
  const data = new Uint8Array(graph.analyser.frequencyBinCount);
  let raf = 0;
  const frame = () => {
    graph.analyser.getByteFrequencyData(data);
    paint(canvas, barLevels(data));
    raf = requestAnimationFrame(frame);
  };
  frame();
  return () => {
    cancelAnimationFrame(raf);
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };
}
