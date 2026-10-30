// Cold and warm page-load measurement in headless Firefox (390px viewport): request timeline, FCP, LCP, transfer size.
// Usage: node scripts/perf.mjs [url]   (default http://localhost:8080/; needs a build served there)
// LCP and request timings depend on the CDN that serves the cover, so compare several runs, not one.
import { firefox } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:8080/';
const b = await firefox.launch({ headless: true });
async function run(label, warm) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const reqs = [];
  page.on('requestfinished', async (r) => {
    const t = r.timing(); const s = await r.sizes().catch(() => null);
    reqs.push({ url: r.url().replace(/^https?:\/\/[^/]+/, (m) => (m.includes('localhost') ? '' : m)).slice(0, 70), type: r.resourceType(), start: Math.round(t.startTime ? t.startTime - t0 : 0), end: Math.round(t.responseEnd > 0 ? t.startTime - t0 + t.responseEnd : 0), xfer: s?.responseBodySize ?? 0 });
  });
  await page.addInitScript(() => {
    window.__lcp = []; window.__paints = {};
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lcp.push({ t: Math.round(e.startTime), el: e.element?.tagName + (e.element?.alt ? '[img]' : ''), size: e.size }))).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  let t0 = Date.now();
  if (warm) { await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); reqs.length = 0; t0 = Date.now(); }
  const t1 = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('h1, h2', { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('img') && document.querySelector('img').complete, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]));
    const res = performance.getEntriesByType('resource').map((r) => ({ n: r.name.replace(location.origin, '').slice(0, 64), t: r.initiatorType, s: Math.round(r.startTime), e: Math.round(r.responseEnd), enc: r.encodedBodySize, dec: r.decodedBodySize, net: r.transferSize }));
    return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), ttfb: Math.round(n.responseStart), paint, lcp: window.__lcp, res };
  });
  console.log(`\n===== ${label}`);
  console.log(`TTFB ${m.ttfb}ms  FCP ${m.paint['first-contentful-paint'] ?? 'n/a'}ms  DCL ${m.dcl}ms  load ${m.load}ms  LCP ${JSON.stringify(m.lcp.at(-1))}`);
  // encodedBodySize is the compressed size even when the browser served the file from its cache; transferSize is 0 then.
  // For cross-origin requests (the CDN) both sizes can be hidden, so they are marked '?' and left out of the network total.
  let enc = 0, dec = 0, net = 0;
  for (const r of m.res) {
    enc += r.enc; dec += r.dec; net += r.net;
    const where = r.n.startsWith('http') ? '?' : r.net === 0 && r.enc > 0 ? 'cache' : 'net'; // cross-origin: the browser hides transferSize
    console.log(`${String(r.s).padStart(5)} -> ${String(r.e).padStart(5)}ms  ${String(r.enc).padStart(7)}B enc ${String(r.dec).padStart(7)}B dec  ${where.padEnd(5)} ${r.t.padEnd(6)} ${r.n}`);
  }
  console.log(`requests ${m.res.length}  size ${(enc / 1024).toFixed(0)} KB (${(dec / 1024).toFixed(0)} KB decoded)  over the network ${(net / 1024).toFixed(0)} KB`);
  console.log('note: which late requests (e.g. the hls.light chunk, loaded after the cover) fall inside the measured window varies with the cover\'s speed');
  await ctx.close();
}
await run('cold cache (first visit)', false);
await run('repeat visit (warm HTTP cache)', true);
await b.close();
