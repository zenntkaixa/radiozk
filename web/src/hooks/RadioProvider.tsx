import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useNowPlaying, type NowPlaying } from '../nowPlaying.ts';
import { BASE_TITLE, setPlayingTitle } from '../pageTitle.ts';
import { isPlayPauseKey, pageTitle, sleepGain, splitTitle } from '../playerUi.ts';
import { useMediaSession } from './useMediaSession.ts';
import { usePresence } from './usePresence.ts';
import { useRadioStream } from './useRadioStream.ts';

export type RadioValue = ReturnType<typeof useRadioStream> & {
  track: NowPlaying | null;
  trackError: boolean;
  /** Listeners right now, or null before the first answer. */
  listening: number | null;
  volume: number;
  setVolume: (v: number) => void;
  /** Sleep timer: the chosen length in minutes and the whole minutes left (rounded up), or null when off. */
  sleep: { minutes: number; left: number } | null;
  setSleep: (minutes: number | null) => void;
};

export const RadioContext = createContext<RadioValue | null>(null);

export function useRadio(): RadioValue {
  const value = useContext(RadioContext);
  if (!value) throw new Error('useRadio must be used inside <RadioProvider>');
  return value;
}

/**
 * Owns the one audio element and everything tied to it (stream, track info, media session, tab title, Space key,
 * volume, listener count). It sits above the pages, so the radio keeps playing when the visitor leaves the Radio
 * page; the Radio page and the mini-player only show and drive it.
 */
export function RadioProvider({ children }: { children: ReactNode }) {
  const stream = useRadioStream();
  const { audioRef, audioProps, status, togglePlay } = stream;
  const { data: track, error: trackError } = useNowPlaying();
  const [volume, setVolume] = useState(0.8);
  const listening = usePresence(status === 'playing');
  useMediaSession(track, status !== 'idle'); // idle until the first Play
  const [sleepSet, setSleepSet] = useState<{ minutes: number; at: number } | null>(null);
  const [sleepLeft, setSleepLeft] = useState(0);
  const onRadioPage = useLocation().pathname === '/';

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [audioRef, volume]);

  // Sleep timer. It compares against a deadline instead of counting ticks, because background tabs throttle timers.
  // The last seconds fade out; then the stream is paused through togglePlay so loading stops too.
  const toggleRef = useRef(togglePlay);
  toggleRef.current = togglePlay;
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => {
    if (!sleepSet) return;
    const audio = audioRef.current;
    const tick = () => {
      const remaining = sleepSet.at - Date.now();
      setSleepLeft(Math.max(1, Math.ceil(remaining / 60000)));
      if (remaining > 0) {
        if (audio) audio.volume = volume * sleepGain(remaining);
        return;
      }
      clearInterval(timer);
      setSleepSet(null);
      if (audio) audio.volume = volume;
      if (statusRef.current === 'playing' || statusRef.current === 'buffering') toggleRef.current();
    };
    const timer = setInterval(tick, 250);
    tick();
    return () => {
      clearInterval(timer);
      if (audio) audio.volume = volume; // cancelled mid-fade: back to the chosen volume
    };
  }, [sleepSet, audioRef, volume]);

  const setSleep = (minutes: number | null) => setSleepSet(minutes ? { minutes, at: Date.now() + minutes * 60000 } : null);

  useEffect(() => {
    const t = pageTitle(BASE_TITLE, status === 'playing', track && { title: splitTitle(track.title).main });
    setPlayingTitle(t === BASE_TITLE ? null : t);
    return () => setPlayingTitle(null);
  }, [status, track]);

  // Space plays and pauses. On other pages it only does so once the radio has started: it must not start music
  // on a page that has no player on it.
  useEffect(() => {
    if (!onRadioPage && status === 'idle') return;
    const onKey = (e: KeyboardEvent) => {
      if (!isPlayPauseKey(e)) return;
      e.preventDefault(); // otherwise Space scrolls the page
      togglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, onRadioPage, status]);

  return (
    <RadioContext.Provider value={{ ...stream, track, trackError, listening, volume, setVolume, sleep: sleepSet && { minutes: sleepSet.minutes, left: sleepLeft }, setSleep }}>
      <audio ref={audioRef} {...audioProps} />
      {children}
    </RadioContext.Provider>
  );
}
