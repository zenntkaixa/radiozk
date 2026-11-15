import type { ReactNode } from 'react';
import { Link } from 'react-router';
import BackToRadio from '../components/BackToRadio.tsx';
import { FEEDBACK_URL } from '../feedback.ts';
import { useDocumentTitle } from '../pageTitle.ts';

const link = 'font-medium text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300';
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const button =
  'inline-flex min-h-11 items-center rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300';
const STACK = ['React', 'Vite', 'TypeScript', 'Tailwind', 'hls.js', 'Express', 'PostgreSQL', 'Render'];

function Card({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-slate-700 dark:text-slate-300 shadow-sm">
      <h2 className="mb-2 flex items-center gap-3 font-semibold text-slate-900 dark:text-slate-100">
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950 text-lg">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function About() {
  useDocumentTitle('About · radiozk');
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">About</h1>
      <p className="mb-6 text-lg text-slate-600 dark:text-slate-400">A hobby radio player, built to learn and kept because it's fun.</p>

      <div className="space-y-4">
        <Card icon="📻" title="The story">
          <p>
            radiozk started as a side project while I was learning to build software with{' '}
            <a className={link} href="https://www.udemy.com/course/anthropic-claude-code/?couponCode=KEEPLEARNING" {...external}>
              a Udemy course on Claude Code
            </a>
            . I wanted something real to practise on, so I built a radio player that sounds good, and it has been a big part of my
            journey as a developer. "zk" is short for zenntkaixa, my name online.
          </p>
        </Card>

        <Card icon="🎧" title="What you're hearing">
          <p>
            The music is{' '}
            <a className={link} href="https://www.radio-calico.com/" {...external}>Radio Calico</a>
            's public lossless stream, and every track belongs to its artists. I only built the player: lossless FLAC where your
            browser can play it, AAC where it can't, and an anonymous thumbs up or down.
          </p>
          <p className="mt-2">
            Thank you,{' '}
            <a className={link} href="https://www.radio-calico.com/" {...external}>Radio Calico</a>
            , for publishing an open lossless stream.
          </p>
        </Card>

        <Card icon="🛠️" title="Under the hood">
          <ul className="flex flex-wrap gap-2">
            {STACK.map((t) => (
              <li key={t} className="rounded-full bg-indigo-50 dark:bg-indigo-950 px-3 py-1 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                {t}
              </li>
            ))}
          </ul>
        </Card>

        <Card icon="👋" title="Say hi">
          <p>
            If you like it, tell me: rate a few songs, send it to a friend, or share an idea (feedback is public on GitHub and needs a free account). I'm always happy to swap notes with
            people learning to build things.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a className={button} href={FEEDBACK_URL} {...external}>Send feedback</a>
            <a className={button} href="https://github.com/zenntkaixa/radiozk" {...external}>GitHub</a>
            <a className={button} href="https://www.linkedin.com/in/mohamad-izzat-fahmi-bin-suhaimi-00b047145/" {...external}>LinkedIn</a>
            <a className={button} href="https://zenntkaixa.dev/" {...external}>Portfolio</a>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <BackToRadio />
        <Link to="/whats-new" className={`${link} inline-flex min-h-11 items-center`}>What's new</Link>
      </div>
    </>
  );
}
