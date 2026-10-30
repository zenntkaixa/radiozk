import { useEffect, useMemo, useRef, useState } from 'react';
import type { Level } from 'hls.js'; // type only: the library itself is loaded on demand, see loadHls()
import { STREAM_URL } from '../config.ts';
import { saveDataRequested, whenIdle } from '../idle.ts';

export type Quality = 'lossless' | 'aac';
export type Status = 'idle' | 'buffering' | 'playing' | 'paused' | 'error';
export type Mode = 'native' | 'hls.js' | 'unsupported';
export interface StreamInfo {
  codec: string;
  lossless: boolean;
}

const isFlac = (l: Level) => /flac/i.test(l.audioCodec ?? '');

// hls.js (the light build: same API minus subtitles, alternate audio and DRM) is ~120 kB gzipped and not needed to
// render the page, so it is fetched after the first paint (or on the first Play, whichever comes first).
let hlsPromise: Promise<typeof import('hls.js').default> | undefined;
function loadHls() {
  hlsPromise ??= import('hls.js/light').then((m) => m.default).catch((e) => {
    hlsPromise = undefined; // allow a retry on the next Play
    throw e;
  });
  return hlsPromise;
}

const hasMse = () => 'MediaSource' in window || 'ManagedMediaSource' in window;

function detectMode(): Mode {
  const canNative = document.createElement('audio').canPlayType('application/vnd.apple.mpegurl') !== '';
  // Safari/iOS play HLS (including FLAC) natively; elsewhere hls.js over MSE is more predictable.
  if (canNative && (navigator.vendor.includes('Apple') || !hasMse())) return 'native';
  return hasMse() ? 'hls.js' : 'unsupported';
}

/**
 * Plays the live HLS stream into the <audio> element that `audioRef` is attached to.
 * Spread `audioProps` onto that element so playback state flows back into `status`.
 */
export function useRadioStream() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<InstanceType<typeof import('hls.js').default> | null>(null);
  // Set when the listener switches quality mid-playback, so the rebuilt player keeps playing.
  const resumeRef = useRef(false);
  // Set when Play is pressed before the player exists; it starts as soon as the manifest is parsed.
  const pendingPlayRef = useRef(false);
  // Builds the player now (assigned by the effect below); a no-op if it is already built or being built.
  const buildNowRef = useRef<(() => void) | null>(null);
  const mode = useMemo(detectMode, []);
  const [quality, setQuality] = useState<Quality>('lossless');
  const [status, setStatus] = useState<Status>('idle');
  const [info, setInfo] = useState<StreamInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || mode !== 'hls.js') return;
    const resume = resumeRef.current;
    resumeRef.current = false;
    setNotice(null);
    setInfo(null);

    let cancelled = false;
    let building = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function build() {
      if (building || cancelled) return;
      building = true;
      let Hls;
      try {
        Hls = await loadHls();
      } catch {
        building = false;
        if (cancelled) return;
        pendingPlayRef.current = false;
        setStatus('error');
        setNotice("Couldn't load the audio player. Check your connection and press Play to try again.");
        return;
      }
      if (cancelled) return; // unmounted or quality changed while the library was loading
      if (!Hls.isSupported()) {
        pendingPlayRef.current = false;
        setStatus('error');
        setNotice("This browser can't play HLS streams.");
        return;
      }

      // Loading is manual: no media is fetched until play (see togglePlay) and it stops on pause.
      const hls = new Hls({ autoStartLoad: false });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // hls.js would otherwise ABR-pick AAC (higher declared bandwidth), so choose the level explicitly.
        const wantLossless = quality === 'lossless';
        const idx = hls.levels.findIndex((l) => isFlac(l) === wantLossless);
        if (idx >= 0) {
          hls.currentLevel = idx;
        } else if (wantLossless) {
          setNotice("This browser can't decode FLAC, so the AAC stream is used instead.");
        }
        if (resume || pendingPlayRef.current) {
          pendingPlayRef.current = false;
          hls.startLoad(-1);
          audio!.play().catch(() => setStatus('paused'));
        }
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        const level = hls.levels[data.level];
        if (level) setInfo({ codec: isFlac(level) ? 'FLAC' : 'AAC', lossless: isFlac(level) });
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setStatus('buffering');
          retry = setTimeout(() => hls.startLoad(-1), 3000);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          setStatus('error');
          setNotice(`Playback failed: ${data.details}`);
        }
      });

      hls.loadSource(STREAM_URL);
      hls.attachMedia(audio!);
    }

    buildNowRef.current = () => void build();
    // Normally the player is built in the background shortly after the page has settled, so that Play is instant.
    // A quality switch during playback (or a Play still waiting for the player) rebuilds it straight away;
    // Save-Data users get it only when they press Play.
    const urgent = resume || pendingPlayRef.current;
    const cancelIdle = urgent || saveDataRequested() ? undefined : whenIdle(() => void build());
    if (urgent) void build();

    return () => {
      cancelled = true;
      cancelIdle?.();
      clearTimeout(retry);
      buildNowRef.current = null;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [mode, quality]);

  useEffect(() => {
    if (mode === 'native' && audioRef.current) {
      audioRef.current.src = STREAM_URL;
      setInfo({ codec: 'Automatic (native HLS)', lossless: false });
    }
  }, [mode]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (pendingPlayRef.current) {
      // Pressed Play, then Play again before the player was ready: treat it as cancelling the start.
      pendingPlayRef.current = false;
      setStatus('idle');
      return;
    }
    setStatus('buffering');
    if (mode === 'native') {
      audio.src = STREAM_URL; // reload so playback resumes at the live edge, not where we paused
      audio.load();
    } else if (!hlsRef.current) {
      // The player isn't built yet (library still loading, or Save-Data): start as soon as it is ready.
      pendingPlayRef.current = true;
      buildNowRef.current?.();
      return;
    } else {
      hlsRef.current.startLoad(-1);
    }
    audio.play().catch((e: Error) => {
      setStatus('error');
      setNotice(`Playback failed: ${e.message}`);
    });
  }

  function changeQuality(q: Quality) {
    resumeRef.current = !!audioRef.current && !audioRef.current.paused;
    if (resumeRef.current) setStatus('buffering');
    setQuality(q);
  }

  const audioProps = {
    onPlaying: () => setStatus('playing'),
    onPause: () => {
      hlsRef.current?.stopLoad();
      setStatus((s) => (s === 'error' ? s : 'paused'));
    },
    onWaiting: () => setStatus((s) => (s === 'playing' ? 'buffering' : s)),
    onError: () => {
      setStatus('error');
      setNotice('The audio element reported an error.');
    },
  };

  return { audioRef, audioProps, mode, quality, status, info, notice, togglePlay, changeQuality };
}
