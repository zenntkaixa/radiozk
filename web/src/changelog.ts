// What's new, newest first. Written for listeners, not developers: add an entry when something visible ships.
export type Release = { date: string; title: string; items: string[] };

export const CHANGELOG: Release[] = [
  {
    date: '2026-11-15',
    title: 'Everything so far',
    items: [
      'The music keeps playing when you open About or any other page, with a small player at the bottom.',
      'See how many people are listening right now, with live frequency bars while the music plays.',
      'Dark mode that follows your device, and a new font.',
      'Sleep timer: stop after 15, 30 or 60 minutes, with a gentle fade-out.',
      'Liked songs: your 👍 songs are kept on this device, each with a link to search it on YouTube.',
      'A Share button, and bigger tap targets on phones.',
      'Install radiozk as an app from your browser.',
      'Send feedback from the About page: it opens GitHub, where you can share an idea or report a problem.',
      'Version notes such as "(2015 Remaster)" now sit under the song title.',
    ],
  },
];
