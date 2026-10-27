import { useEffect, useMemo, useRef, useState } from 'react';
import Hls, { type Level } from 'hls.js';
import type { NowPlaying } from '../nowPlaying.ts';

export const STREAM_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8';

type Quality = 'lossless' | 'aac';
type Status = 'idle' | 'buffering' | 'playing' | 'paused' | 'error';
type Mode = 'native' | 'hls.js' | 'unsupported';
interface Info {
  codec: string;
  lossless: boolean;
}

const isFlac = (l: Level) => /flac/i.test(l.audioCodec ?? '');

function detectMode(): Mode {
  const canNative = document.createElement('audio').canPlayType('application/vnd.apple.mpegurl') !== '';
  // Safari/iOS play HLS (including FLAC) natively; elsewhere hls.js over MSE is more predictable.
  if (canNative && (navigator.vendor.includes('Apple') || !Hls.isSupported())) return 'native';
  return Hls.isSupported() ? 'hls.js' : 'unsupported';
}

export default function RadioPlayer({ track }: { track?: NowPlaying | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const resumeRef = useRef(false);
  const mode = useMemo(detectMode, []);
  const [quality, setQuality] = useState<Quality>('lossless');
  const [status, setStatus] = useState<Status>('idle');
  const [info, setInfo] = useState<Info | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || mode !== 'hls.js') return;
    const resume = resumeRef.current;
    resumeRef.current = false;
    setNotice(null);
    setInfo(null);

    const hls = new Hls({ autoStartLoad: false });
    hlsRef.current = hls;
    let retry: ReturnType<typeof setTimeout> | undefined;

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      // hls.js would otherwise ABR-pick AAC (higher declared bandwidth), so choose the level explicitly.
      const wantLossless = quality === 'lossless';
      const idx = hls.levels.findIndex((l) => isFlac(l) === wantLossless);
      if (idx >= 0) {
        hls.currentLevel = idx;
      } else if (wantLossless) {
        setNotice("This browser can't decode FLAC, so the AAC stream is used instead.");
      }
      if (resume) {
        hls.startLoad(-1);
        audio.play().catch(() => setStatus('paused'));
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
    hls.attachMedia(audio);
    return () => {
      clearTimeout(retry);
      hls.destroy();
      hlsRef.current = null;
    };
  }, [mode, quality]);

  useEffect(() => {
    if (mode === 'native' && audioRef.current) {
      audioRef.current.src = STREAM_URL;
      setInfo({ codec: 'Automatic (native HLS)', lossless: false });
    }
  }, [mode]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track?.title || 'radiozk live',
      artist: track?.artist || 'Lossless radio',
      album: track?.album ?? '',
      artwork: track ? [{ src: track.coverUrl }] : [],
    });
  }, [track]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setStatus('buffering');
    if (mode === 'native') {
      audio.src = STREAM_URL; // reload so playback resumes at the live edge, not where we paused
      audio.load();
    } else {
      hlsRef.current?.startLoad(-1);
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

  const label = { idle: 'Ready', buffering: 'Buffering…', playing: 'Live', paused: 'Paused', error: 'Error' }[status];

  if (mode === 'unsupported') {
    return <p className="text-red-700">This browser can't play HLS streams.</p>;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <audio
        ref={audioRef}
        onPlaying={() => setStatus('playing')}
        onPause={() => {
          hlsRef.current?.stopLoad();
          setStatus((s) => (s === 'error' ? s : 'paused'));
        }}
        onWaiting={() => setStatus((s) => (s === 'playing' ? 'buffering' : s))}
        onError={() => {
          setStatus('error');
          setNotice('The audio element reported an error.');
        }}
      />

      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          aria-label={status === 'playing' || status === 'buffering' ? 'Pause' : 'Play'}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
        >
          {status === 'playing' || status === 'buffering' ? (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <div>
          <p className="text-lg font-semibold">radiozk live</p>
          <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
            <span className={`h-2 w-2 rounded-full ${status === 'playing' ? 'animate-pulse bg-red-500' : 'bg-slate-300'}`} />
            {label}
            {info && <span className="text-slate-400">·</span>}
            {info && (
              <span className={info.lossless ? 'font-medium text-indigo-600' : ''}>
                {info.codec}
                {info.lossless && ' · lossless'}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <label htmlFor="vol" className="text-sm text-slate-600">Volume</label>
        <input
          id="vol"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 accent-indigo-600"
        />
      </div>

      {mode === 'hls.js' && (
        <fieldset className="mt-4 flex gap-4 text-sm">
          <legend className="sr-only">Stream quality</legend>
          {(['lossless', 'aac'] as const).map((q) => (
            <label key={q} className="flex items-center gap-2">
              <input type="radio" name="quality" checked={quality === q} onChange={() => changeQuality(q)} className="accent-indigo-600" />
              {q === 'lossless' ? 'Lossless (FLAC)' : 'Compatibility (AAC)'}
            </label>
          ))}
        </fieldset>
      )}
      {mode === 'native' && <p className="mt-4 text-sm text-slate-500">Your browser plays the stream natively and chooses the quality automatically.</p>}
      {notice && <p className="mt-4 text-sm text-amber-700">{notice}</p>}
    </section>
  );
}
