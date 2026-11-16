# radiozk: a case study

> **Draft for the author to edit.** Every fact below comes from the repository, its history or the live site. Lines marked ✏️ need your own words: why you built it, what you would say to an interviewer. Delete this note when you are happy with it.

**Live:** <https://zenntkaixa-radiozk.onrender.com> · **Code:** <https://github.com/zenntkaixa/radiozk>

## The project in one paragraph

radiozk is a web player for [Radio Calico](https://www.radio-calico.com/)'s public lossless stream. You press play and hear FLAC in the browser, see the current track and its quality (for example 24-bit / 48 kHz), rate songs with a thumbs up or down, and keep playing while you browse. It started on 2026-10-27 as a way to learn by building something real, while following a Udemy course on Claude Code, and it grew into a deployed, tested site: roughly 190 commits and 90 pull requests in three weeks. ✏️ *One sentence on why a radio player, and why lossless.*

## What it is made of

- **Front end:** React 19, TypeScript, Vite, Tailwind, React Router, hls.js.
- **API:** Node and Express with PostgreSQL, for two small jobs: anonymous ratings and a live "listening with you" count.
- **Delivery:** nginx locally and in Docker; on Render, a static site plus a Node service, with a free Neon database.
- **The stream** is not ours. The browser talks to Radio Calico's CDN directly for audio, track metadata and covers. Our API never touches the stream.

## Decisions that shaped it

**One player above the pages.** The `<audio>` element and everything tied to it live in a provider above the router, so opening About doesn't cut the music. The Radio page is only a card that shows and drives it.

**Keep the hot path out of the database.** The listener count could have been a table written to every 30 seconds per listener. On Neon's free plan that would keep the database awake all day, so presence lives in the API's memory instead. It resets on restart, and the About page and docs call it decoration, not a statistic.

**Anonymous, and say so.** No accounts, no cookies, no tracking: a random ID in the browser identifies a voter. The About page has a "What's stored" card that says exactly what is kept where, and it is kept in step with the code.

**Feedback where the user is.** Feedback goes to GitHub Issues because it is tracked and free. Visitors without an account get a Google Form instead, opened as a link so no third-party code runs on the page.

## Things that went wrong, and what I did

1. **A flaky end-to-end test.** The browser test asserted that audio advanced by an exact amount per wall-clock window. Whenever the CDN stalled, it failed: about half of the runs on a bad day. The fix was to wait until the audio has advanced N seconds within a timeout, which tests what matters (it plays in real time) and not how steadily the network delivered it.
2. **Audio that went silent.** The frequency bars tap the audio through the Web Audio API. Creating the tap while the audio context was still suspended silenced the stream for good. The graph is now built only once the context is running, and a test covers it.
3. **The wrong default quality.** hls.js picks the variant with the highest declared bandwidth, which is the AAC one, so a "lossless" player was quietly playing lossy audio. The FLAC level is now pinned explicitly, with AAC as a user choice and an automatic fallback for browsers that can't decode FLAC.
4. **A rate limit that trusted the wrong address.** Votes are limited per IP, but behind nginx and Render's proxy every client can look like one address, or a client can forge `X-Forwarded-For`. nginx overwrites that header, the API trusts only its proxy, and a security test forges the header to prove the limit still holds. On Render I verified it from two networks.
5. **A contrast measurement I got wrong.** I first checked text contrast by reading Tailwind's colours as if they were RGB, but they are `oklch()`, so the numbers were meaningless. Measured properly, through a canvas over the real background, the card's grey text was only 3.4:1 (2.4:1 over a black cover), under the 4.5:1 AA minimum. I corrected it and said in the pull request what the first measurement had missed. It is now 6.2:1 and 4.9:1.
6. **A layout that jumped.** The first Play added a line of text and pushed everything down 36 px on a phone. The line is now always there with its height reserved.
7. **A free database that expires.** Render's free Postgres expires after 30 days. The data moved to Neon, with a backup script and a documented restore.

## How I worked

Small pull requests into a `develop` branch, release pull requests into `main`, merge commits, and CI as a gate: type check, tests, CodeQL, `npm audit` and Trivy image scans. After every release I checked the live site read-only: the deploy commit equals the merge commit, the health endpoint answers, and the JavaScript the site serves is byte-for-byte what a local build produces. A bundle-size budget fails the build if the initial download grows, and hls.js is loaded on demand.

I built it with Claude Code as a pair programmer: it wrote and reviewed much of the code and ran the checks, and I chose what to build, what to leave out (no restyling, no tips, no own feedback backend until there is feedback), and when to ship. ✏️ *Say in your own words what you decided and what you learned from that split.*

## What it doesn't do, honestly

- Playback is tested in Firefox and Chromium, not on Safari or iPhone. Installing as an app was verified on Android Chrome only.
- The listener count can be inflated with made-up IDs, and ratings can be stuffed from many addresses. Both are accepted risks, documented and covered by a test marked as a known gap.
- There is no audio device in CI, so the tests prove the audio decodes and advances, not that it sounds right.

## What I would do next

A real-phone pass on iOS, a "why lossless" explainer people can share, and, only if feedback arrives, an own feedback channel with the privacy and security work that needs. ✏️ *Add what you would like to learn next.*

## Numbers

| | |
|---|---|
| Time from first commit to live site with CI | about three weeks |
| Merged pull requests | about 90 |
| Browser end-to-end checks | 52 |
| UI unit tests | 166 |
| Initial download (gzip) | about 95 KB, with the player library (about 111 KB) loaded on demand |
