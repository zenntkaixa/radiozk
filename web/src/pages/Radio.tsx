import RadioPlayer from '../components/RadioPlayer.tsx';
import NowPlaying from '../components/NowPlaying.tsx';
import { useNowPlaying } from '../nowPlaying.ts';

export default function Radio() {
  const { data, error } = useNowPlaying();
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Listen live</h1>
      <RadioPlayer track={data} />
      <NowPlaying data={data} error={error} />
      <p className="mt-4 text-sm text-slate-500">
        Music from{' '}
        <a className="underline underline-offset-2 hover:text-slate-700" href="https://www.radio-calico.com/" target="_blank" rel="noopener noreferrer">
          Radio Calico
        </a>
        's public stream, as lossless FLAC over HLS, with an AAC fallback for browsers that can't decode FLAC.
      </p>
    </>
  );
}
