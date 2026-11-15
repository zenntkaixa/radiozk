// What's new, newest first. Written for listeners, not developers: add an entry when something visible ships.
export type Release = { date: string; title: string; items: string[] };

export const CHANGELOG: Release[] = [
  {
    date: '2026-11-15',
    title: 'Tell me what you think',
    items: [
      'A "Send feedback" button on the About page opens GitHub, where you can share an idea or report a problem.',
      'The web app can now be installed from your browser, and this What\'s new page is new too.',
    ],
  },
  {
    date: '2026-11-15',
    title: 'Sleep timer, liked songs and sharing',
    items: [
      'Sleep timer: stop after 15, 30 or 60 minutes, with a gentle fade-out.',
      'Liked songs: your 👍 songs are kept on this device, each with a link to search it on YouTube.',
      'A Share button, and bigger tap targets on phones.',
    ],
  },
  {
    date: '2026-11-15',
    title: 'The music keeps playing',
    items: [
      'Open About (or any page) and the radio keeps going, with a small player at the bottom.',
      'Version notes such as "(2015 Remaster)" now sit under the song title.',
    ],
  },
  {
    date: '2026-11-15',
    title: 'Listening with you, frequency bars and dark mode',
    items: [
      'See how many people are listening right now.',
      'Live frequency bars while the music plays.',
      'Dark mode that follows your device, and a new font.',
    ],
  },
];
