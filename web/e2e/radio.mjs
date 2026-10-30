// End-to-end check of the Radio page in Firefox (Playwright). Usage: node e2e/radio.mjs [baseUrl]
import { firefox } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:8080';
const shots = process.env.SHOTS ?? '/tmp/claude-1000/shots';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 } });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

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
  const sample = () => page.evaluate(() => { const a = document.querySelector('audio'); return { t: a.currentTime, paused: a.paused, ready: a.readyState, err: a.error?.message ?? null }; });
  await page.waitForTimeout(4000); // allow for the ~2s startup rebuffer seen on first play
  const s0 = await sample();
  await page.waitForTimeout(6000);
  const s1 = await sample();
  const advanced = s1.t - s0.t;
  const statusText = (await status.textContent())?.replace(/\s+/g, ' ').trim();
  check('audio plays (advances ~real time over 6s)', advanced > 5.2 && !s1.paused && !s1.err, `advanced ${advanced.toFixed(1)}s, ready=${s1.ready}, err=${s1.err}`);
  check('status says Live', /Live/.test(statusText ?? ''), statusText);
  check('lossless FLAC selected', /FLAC/.test(statusText ?? '') && /lossless/.test(statusText ?? ''), statusText);
  await page.screenshot({ path: `${shots}/2-playing.png`, fullPage: true });

  // --- pause / resume ---
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForFunction(() => document.querySelector('audio').paused, null, { timeout: 5000 });
  check('pause works', /Paused/.test((await status.textContent()) ?? ''));

  // --- AAC fallback switch ---
  await page.getByLabel('Compatibility (AAC)').check();
  await page.getByRole('button', { name: 'Play' }).click();
  const aacOk = await page
    .waitForFunction(() => /AAC/.test(document.querySelector('[role=status]')?.textContent ?? '') && document.querySelector('audio').currentTime > 1 && !document.querySelector('audio').paused, null, { timeout: 40000 })
    .then(() => true).catch(() => false);
  check('AAC option plays', aacOk, (await status.textContent())?.replace(/\s+/g, ' ').trim());
  await page.getByLabel('Lossless (FLAC)').check();
  await page.getByRole('button', { name: /Pause|Play/ }).first().waitFor();

  // --- ratings ---
  const up = now.getByRole('button', { name: 'I like this track' });
  const down = now.getByRole('button', { name: "I don't like this track" });
  await up.waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-label="I like this track"]').disabled, null, { timeout: 5000 });
  const upCount = async () => Number((await up.textContent()).replace(/\D/g, '') || 0);
  const c0 = await upCount();
  await up.click();
  await page.waitForFunction(() => document.querySelector('[aria-label="I like this track"]').getAttribute('aria-pressed') === 'true');
  check('thumbs up registers', (await upCount()) === c0 + 1, `${c0} -> ${await upCount()}`);
  await down.click();
  await page.waitForFunction(() => document.querySelector('[aria-label="I like this track"]').getAttribute('aria-pressed') === 'false' && document.querySelector('[aria-label="I don\'t like this track"]').getAttribute('aria-pressed') === 'true');
  check('switching to thumbs down moves the vote', (await upCount()) === c0);
  // The UI updates optimistically; wait for the save to finish before reloading.
  await Promise.all([page.waitForResponse((r) => r.url().includes('/api/ratings') && r.request().method() === 'POST'), up.click()]);
  await page.waitForFunction(() => document.querySelector('[aria-label="I like this track"]').getAttribute('aria-pressed') === 'true');
  await page.reload();
  await page.getByRole('region', { name: 'Now playing' }).getByRole('button', { name: 'I like this track' }).waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-label="I like this track"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 8000 });
  check('vote persists after reload (same listener id)', true);
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
    await p.waitForTimeout(4000); // startup rebuffer
    const at = () => p.evaluate(() => document.querySelector('audio').currentTime);
    const a0 = await at();
    await p.waitForTimeout(4000);
    const advancedFresh = (await at()) - a0;
    const st = (await p.getByRole('status').textContent())?.replace(/\s+/g, ' ').trim();
    check(`first Play ${label}: plays`, advancedFresh > 3.4 && /Live/.test(st ?? ''), `advanced ${advancedFresh.toFixed(1)}s in 4s, ${st}`);
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
