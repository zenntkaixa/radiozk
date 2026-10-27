import { useEffect } from 'react';
import type { NowPlaying } from '../nowPlaying.ts';

/** Keeps the OS/browser media controls (lock screen, headset keys) showing the current track. */
export function useMediaSession(track: NowPlaying | null | undefined) {
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track?.title || 'radiozk live',
      artist: track?.artist || 'Lossless radio',
      album: track?.album ?? '',
      artwork: track ? [{ src: track.coverUrl }] : [],
    });
  }, [track]);
}
