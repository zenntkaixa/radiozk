import { Link } from 'react-router';
import RadioPlayer from '../components/RadioPlayer.tsx';
import NowPlaying from '../components/NowPlaying.tsx';
import { useRadio } from '../hooks/RadioProvider.tsx';

export default function Radio() {
  const { track, trackError } = useRadio();
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Listen live</h1>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <RadioPlayer />
        <NowPlaying data={track} error={trackError} />
      </div>
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Music from{' '}
        <a className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200" href="https://www.radio-calico.com/" target="_blank" rel="noopener noreferrer">
          Radio Calico
        </a>
        's public stream, as lossless FLAC over HLS, with an AAC fallback for browsers that can't decode FLAC.{' '}
        <Link to="/whats-new" className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">What's new</Link>
      </p>
    </>
  );
}
