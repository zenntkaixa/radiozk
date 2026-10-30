// End-to-end check of the Radio page (Playwright). Usage: [BROWSER=chromium] node e2e/radio.mjs [baseUrl]
// Firefox is the default; BROWSER=chromium runs the same checks in Chromium (needs: npx playwright install chromium).
import { chromium, firefox } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:8080';
const shots = process.env.SHOTS ?? '/tmp/claude-1000/shots';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// The stream is live and comes from a CDN, so it sometimes stalls for a second or two to rebuffer. Instead of asserting
// "5.2 s of media in exactly 6 s" (which failed whenever the CDN hiccuped), wait until the <audio> has advanced `seconds`
// of media, within `timeoutMs`. A live stream cannot play faster than real time, so this still proves it decodes and
// advances; a stall that does not recover within the timeout still fails.
async function mediaAdvance(p, seconds, timeoutMs) {
  const read = () => p.evaluate(() => { const a = document.querySelector('audio'); return { t: a.currentTime, paused: a.paused, err: a.error?.message ?? null }; });
  const start = Date.now();
  const first = await read();
  let last = first;
  while (last.t - first.t < seconds && Date.now() - start < timeoutMs) {
    await p.waitForTimeout(250);
    last = await read();
  }
  return { advanced: last.t - first.t, wall: (Date.now() - start) / 1000, paused: last.paused, err: last.err };
}

const engine = process.env.BROWSER === 'chromium' ? chromium : firefox;
const browser = await engine.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 } });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

// The CSP sent by nginx must not block anything the player needs (script hash, CDN, blob: media and worker).
await page.addInitScript(() => {
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(`${e.violatedDirective} blocked ${e.blockedURI}`));
});

try {
  await page.goto(base);
  await page.getByRole('heading', { name: 'Listen live' }).waitFor({ timeout: 10000 });
  check('home page is the radio player', true);
  await page.goto(`${base}/radio`);
  await page.getByRole('heading', { name: 'Listen live' }).waitFor({ timeout: 10000 });
  check('/radio redirects to /', new URL(page.url()).pathname === '/', page.url());

  const caps = await page.evaluate(() => ({
    mse: typeof MediaSource !== 'undefined',
    flacMse: typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mp4; codecs="flac"'),
    aacMse: typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"'),
    nativeHls: document.createElement('audio').canPlayType('application/vnd.apple.mpegurl'),
  }));
  console.log('      capabilities:', JSON.stringify(caps));

  const now = page.getByRole('region', { name: 'Now playing' });
  await now.getByText(/\d+-bit \/ [\d.]+ kHz/).waitFor({ timeout: 15000 }).catch(() => {});
  const title = await now.locator('p.text-lg').textContent().catch(() => null);
  check('now playing shows a track', !!title && title !== 'Unknown title', title ?? 'none');
  check('quality badge shown', (await now.getByText(/\d+-bit \/ [\d.]+ kHz/).count()) === 1);
  const coverOk = await now
    .locator('img')
    .evaluate((i) => (i.complete && i.naturalWidth > 0 ? true : new Promise((res) => { i.onload = () => res(true); i.onerror = () => res(false); setTimeout(() => res(false), 10000); })))
    .catch(() => false);
  check('cover image loaded', coverOk);
  check('recently played lists tracks', (await now.locator('ol li').count()) >= 1, `${await now.locator('ol li').count()} items`);
  await page.screenshot({ path: `${shots}/1-loaded.png`, fullPage: true });

  // Before the first Play the media session must stay untouched: setting its metadata makes the browser download
  // the cover a second time, competing with the visible one.
  const sessionTitle = () => page.evaluate(() => navigator.mediaSession?.metadata?.title ?? null);
  check('media session untouched before Play', (await sessionTitle()) === null, String(await sessionTitle()));

  // --- playback ---
  await page.getByRole('button', { name: 'Play' }).click();
  const status = page.getByRole('status');
  await page.waitForFunction(() => !!navigator.mediaSession?.metadata?.title, null, { timeout: 10000 }).catch(() => {});
  check('media session set once playing', !!(await sessionTitle()), String(await sessionTitle()));
  // The live timeline doesn't start at 0, so measure real advancement over wall-clock time.
  await page.waitForFunction(() => { const a = document.querySelector('audio'); return a && !a.paused && a.readyState >= 3; }, null, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000); // let the ~2s startup rebuffer pass
  const m = await mediaAdvance(page, 5, 25000);
  await page.waitForFunction(() => /Live/.test(document.querySelector('[role=status]')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
  const statusText = (await status.textContent())?.replace(/\s+/g, ' ').trim();
  check('audio plays (advances 5s of media within 25s)', m.advanced >= 5 && !m.paused && !m.err, `advanced ${m.advanced.toFixed(1)}s in ${m.wall.toFixed(1)}s, err=${m.err}`);
  check('status says Live', /Live/.test(statusText ?? ''), statusText);
  check('lossless FLAC selected', /FLAC/.test(statusText ?? '') && /lossless/.test(statusText ?? ''), statusText);
  await page.screenshot({ path: `${shots}/2-playing.png`, fullPage: true });

  // --- pause / resume ---
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForFunction(() => document.querySelector('audio').paused, null, { timeout: 5000 });
  // `audio.paused` flips at once, but the status text follows from the `pause` event, so wait for it instead of reading it.
  check('pause works', await page.waitForFunction(() => /Paused/.test(document.querySelector('[role=status]')?.textContent ?? ''), null, { timeout: 5000 }).then(() => true, () => false));

  // --- AAC fallback switch ---
  await page.getByLabel('Compatibility (AAC)').check();
  await page.getByRole('button', { name: 'Play' }).click();
  const aacOk = await page
    .waitForFunction(() => /AAC/.test(document.querySelector('[role=status]')?.textContent ?? '') && document.querySelector('audio').currentTime > 1 && !document.querySelector('audio').paused, null, { timeout: 40000 })
    .then(() => true).catch(() => false);
  check('AAC option plays', aacOk, (await status.textContent())?.replace(/\s+/g, ' ').trim());
  await page.getByLabel('Lossless (FLAC)').check();
  const violations = await page.evaluate(() => window.__cspViolations);
  check('no Content-Security-Policy violations (page, FLAC and AAC playback)', violations.length === 0, violations.join('; '));
  await page.getByRole('button', { name: /Pause|Play/ }).first().waitFor();

  // --- ratings ---
  const up = now.getByRole('button', { name: 'I like this track' });
  const down = now.getByRole('button', { name: "I don't like this track" });
  await up.waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-label="I like this track"]').disabled, null, { timeout: 5000 });
  const upCount = async () => Number((await up.textContent()).replace(/\D/g, '') || 0);
  const c0 = await upCount();
  const trackAtVote = (await now.locator('p.text-lg').textContent())?.trim();
  await up.click();
  await page.waitForFunction(() => document.querySelector('[aria-label="I like this track"]').getAttribute('aria-pressed') === 'true');
  check('thumbs up registers', (await upCount()) === c0 + 1, `${c0} -> ${await upCount()}`);
  await down.click();
  await page.waitForFunction(() => document.querySelector('[aria-label="I like this track"]').getAttribute('aria-pressed') === 'false' && document.querySelector('[aria-label="I don\'t like this track"]').getAttribute('aria-pressed') === 'true');
  check('switching to thumbs down moves the vote', (await upCount()) === c0);
  // The UI updates optimistically; wait for the save to finish before reloading.
  await Promise.all([page.waitForResponse((r) => r.url().includes('/api/ratings') && r.request().method() === 'POST'), up.click()]);
  await page.waitForFunction(() => document.querySelector('[aria-label="I like this track"]').getAttribute('aria-pressed') === 'true');
  // The station changes track every few minutes. If that happens between the vote and the reload, the new track has no
  // vote to show, so vote on it and reload again (a second change in a row is practically impossible).
  const likeLabel = '[aria-label="I like this track"]';
  let persisted = false;
  let tracksAtVote = [trackAtVote];
  for (let attempt = 0; attempt < 3 && !persisted; attempt++) {
    await page.reload();
    await now.getByRole('button', { name: 'I like this track' }).waitFor();
    const trackAfter = (await now.locator('p.text-lg').textContent())?.trim();
    if (trackAfter === tracksAtVote.at(-1)) {
      persisted = await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('aria-pressed') === 'true', likeLabel, { timeout: 8000 }).then(() => true, () => false);
      break;
    }
    tracksAtVote.push(trackAfter);
    console.log(`      track changed during the vote test ("${tracksAtVote.at(-2)}" -> "${trackAfter}"), voting again`);
    await page.waitForFunction((sel) => !document.querySelector(sel).disabled, likeLabel, { timeout: 5000 });
    await Promise.all([page.waitForResponse((r) => r.url().includes('/api/ratings') && r.request().method() === 'POST'), now.getByRole('button', { name: 'I like this track' }).click()]);
  }
  check('vote persists after reload (same listener id)', persisted, tracksAtVote.join(' -> '));
  await page.getByRole('button', { name: 'I like this track' }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="I like this track"]').getAttribute('aria-pressed') === 'false');
  check('tapping own vote clears it', true);
  await page.screenshot({ path: `${shots}/3-rated.png`, fullPage: true });

  // --- first Play, both ways: the player library is loaded in the background ~2s after the page settles ---
  // (a) Play pressed before it exists: the hook loads it, waits for the manifest, then calls play() outside the click.
  // (b) Play pressed after it is ready: the click starts playback directly.
  for (const [label, waitForLibrary] of [['before the player library is loaded', false], ['after the player library is ready', true]]) {
    const fresh = await browser.newContext({ viewport: { width: 900, height: 1100 } });
    const p = await fresh.newPage();
    await p.goto(base);
    const playBtn = p.getByRole('button', { name: 'Play' });
    await playBtn.waitFor({ timeout: 10000 });
    const libraryLoaded = () => p.evaluate(() => performance.getEntriesByType('resource').some((r) => /hls\.light/.test(r.name)));
    if (waitForLibrary) await p.waitForFunction(() => performance.getEntriesByType('resource').some((r) => /hls\.light/.test(r.name)), null, { timeout: 15000 }).catch(() => {});
    const loadedAtClick = await libraryLoaded();
    check(`first Play ${label}: tests the intended path`, loadedAtClick === waitForLibrary, `library loaded at click: ${loadedAtClick}`);
    await playBtn.click();
    await p.waitForFunction(() => { const a = document.querySelector('audio'); return a && !a.paused && a.readyState >= 3; }, null, { timeout: 40000 }).catch(() => {});
    await p.waitForTimeout(2000); // startup rebuffer
    const mf = await mediaAdvance(p, 3, 20000);
    await p.waitForFunction(() => /Live/.test(document.querySelector('[role=status]')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
    const st = (await p.getByRole('status').textContent())?.replace(/\s+/g, ' ').trim();
    check(`first Play ${label}: plays`, mf.advanced >= 3 && !mf.err && /Live/.test(st ?? ''), `advanced ${mf.advanced.toFixed(1)}s in ${mf.wall.toFixed(1)}s, ${st}`);
    await fresh.close();
  }

  // --- routing / deep links ---
  await page.goto(`${base}/about`);
  check('deep link /about works', await page.getByRole('heading', { name: 'About' }).waitFor({ timeout: 10000 }).then(() => true, () => false));
  await page.getByRole('link', { name: 'Radio' }).click();
  check('client-side nav to Radio', await page.getByRole('heading', { name: 'Listen live' }).waitFor({ timeout: 10000 }).then(() => true, () => false));
  await page.goto(`${base}/nope`);
  check('unknown route shows Not Found', await page.getByRole('heading', { name: 'Page not found' }).isVisible());
} catch (e) {
  check('test run completed without exception', false, e.message.split('\n')[0]);
  await page.screenshot({ path: `${shots}/error.png`, fullPage: true }).catch(() => {});
}

console.log('\nbrowser problems:', problems.length ? '' : 'none');
for (const p of [...new Set(problems)].slice(0, 15)) console.log('  ', p.slice(0, 200));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
