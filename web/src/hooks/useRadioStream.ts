import { useEffect, useMemo, useRef, useState } from 'react';
import Hls, { type Level } from 'hls.js';
import { STREAM_URL } from '../config.ts';

export type Quality = 'lossless' | 'aac';
export type Status = 'idle' | 'buffering' | 'playing' | 'paused' | 'error';
export type Mode = 'native' | 'hls.js' | 'unsupported';
export interface StreamInfo {
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

/**
 * Plays the live HLS stream into the <audio> element that `audioRef` is attached to.
 * Spread `audioProps` onto that element so playback state flows back into `status`.
 */
export function useRadioStream() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Set when the listener switches quality mid-playback, so the rebuilt player keeps playing.
  const resumeRef = useRef(false);
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

    // Loading is manual: nothing is fetched until play (see togglePlay) and it stops on pause.
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
