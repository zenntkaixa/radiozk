const link = 'font-medium text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300';
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

export default function About() {
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">About</h1>
      <p className="mb-6 text-lg text-slate-600 dark:text-slate-400">A hobby radio player, built to learn and kept because it's fun.</p>

      <div className="space-y-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-slate-700 dark:text-slate-300 shadow-sm">
        <section>
          <h2 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">The story</h2>
          <p>
            radiozk started as a side project while I was learning to build software with{' '}
            <a className={link} href="https://www.udemy.com/course/anthropic-claude-code/?couponCode=KEEPLEARNING" {...external}>
              a Udemy course on Claude Code
            </a>
            . I wanted something real to practise on, not another to-do list, so I picked something I'd actually enjoy using: a
            radio player that sounds good. It has grown from a blank folder into a live site, and it has been a big part of my
            journey as a developer. The name is just as personal: "zk" is short for zenntkaixa, my name online.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">What you're hearing</h2>
          <p>
            The music is{' '}
            <a className={link} href="https://www.radio-calico.com/" {...external}>Radio Calico</a>
            's public lossless stream, and every track belongs to its artists. I only built the
            player around it: lossless FLAC where your browser can play it, AAC where it can't, and a thumbs up or down for
            whatever is on. Votes are anonymous, so no account is needed.
          </p>
          <p className="mt-3">
            Thank you,{' '}
            <a className={link} href="https://www.radio-calico.com/" {...external}>Radio Calico</a>
            , for publishing an open lossless stream. radiozk wouldn't exist without it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Under the hood</h2>
          <p>React and Vite on the front end, Express and PostgreSQL behind it, hosted on Render. The code is open on{' '}
            <a className={link} href="https://github.com/zenntkaixa/radiozk" {...external}>GitHub</a>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Say hi</h2>
          <p>
            If you like it, the nicest thing you can do is tell me. Rate a few songs, send it to a friend, or{' '}
            <a className={link} href="https://www.linkedin.com/in/mohamad-izzat-fahmi-bin-suhaimi-00b047145/" {...external}>
              connect with me on LinkedIn
            </a>
            . My{' '}
            <a className={link} href="https://zenntkaixa.dev/" {...external}>portfolio</a> has more of what I build and other
            ways to reach me. I'm always happy to swap notes with people learning to build things.
          </p>
        </section>
      </div>
    </>
  );
}
