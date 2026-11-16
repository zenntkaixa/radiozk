/** A collapsed explainer under the player card (native <details>, no JS). Claims stay modest: what lossless is, not what you will hear. */
export default function WhyLossless() {
  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      <summary className="min-h-6 cursor-pointer font-medium text-slate-700 dark:text-slate-300">Why lossless?</summary>
      <div className="mt-2 space-y-2">
        <p>
          Most streams use lossy compression such as AAC: the encoder throws away detail it judges you won't notice, and it can't be brought back.
          FLAC compresses the audio without throwing anything away, so what you hear is what the station sent: bit for bit.
        </p>
        <p>
          Whether you can hear the difference depends on the recording, your headphones or speakers and your ears, and many people can't. It does use
          more data, which is why there is a Compatibility (AAC) choice for slow connections.
        </p>
      </div>
    </details>
  );
}
