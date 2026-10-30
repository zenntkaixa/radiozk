// Fails when the built front end outgrows its size budget. Usage: node scripts/check-size.mjs [builtDir]
// Sizes are gzip level 6 (what nginx sends, see dev/nginx/nginx.conf). Byte sizes only: timings depend on the CDN
// and the machine, so they stay a manual measurement (scripts/perf.mjs).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const KB = 1024;
// Measured when set: initial ~86 KB JS + ~4 KB CSS, hls.light ~114 KB. Raise a limit deliberately, in the PR that needs it.
export const BUDGET = {
  initialKb: 95, // everything index.html loads up front (JS + CSS)
  lazyChunkKb: 120, // each other JS chunk (hls.js/light is loaded on demand)
};
// A string only hls.js contains: finding it in the initial bundle means the player library is back on the critical path.
const HLS_MARKER = 'hlsManifestParsed';

const gzipKb = (file) => gzipSync(readFileSync(file), { level: 6 }).length / KB;

/** Files index.html loads up front (scripts, stylesheets, modulepreloads), as paths relative to `dir`. */
export function initialFiles(html) {
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"[^>]*>/g)]
    .filter(([tag]) => !/rel="(?:icon|preconnect)"/.test(tag))
    .map(([, ref]) => ref)
    .filter((ref) => /\.(?:js|css)$/.test(ref) && !/^https?:/.test(ref));
  return [...new Set(refs.map((ref) => ref.replace(/^\//, '')))];
}

function listJs(dir) {
  return readdirSync(join(dir, 'assets'), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => `assets/${f}`);
}

/** Returns { problems: string[], lines: string[] } for a built directory. */
export function checkSize(dir, budget = BUDGET) {
  const problems = [];
  const lines = [];
  const initial = initialFiles(readFileSync(join(dir, 'index.html'), 'utf8'));
  let initialKb = 0;
  for (const f of initial) {
    const kb = gzipKb(join(dir, f));
    initialKb += kb;
    lines.push(`  initial  ${kb.toFixed(1).padStart(6)} KB  ${f}`);
    if (f.endsWith('.js') && readFileSync(join(dir, f), 'utf8').includes(HLS_MARKER)) {
      problems.push(`${f} contains hls.js: the player library must be loaded on demand, not with the page`);
    }
  }
  lines.push(`  initial total ${initialKb.toFixed(1)} KB of ${budget.initialKb} KB`);
  if (initialKb > budget.initialKb) problems.push(`initial JS+CSS is ${initialKb.toFixed(1)} KB gzipped, over the ${budget.initialKb} KB budget`);

  for (const f of listJs(dir).filter((f) => !initial.includes(f))) {
    const kb = gzipKb(join(dir, f));
    lines.push(`  lazy     ${kb.toFixed(1).padStart(6)} KB  ${f}`);
    if (kb > budget.lazyChunkKb) problems.push(`${f} is ${kb.toFixed(1)} KB gzipped, over the ${budget.lazyChunkKb} KB limit for a lazy chunk`);
  }
  return { problems, lines };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'www'));
  const { problems, lines } = checkSize(dir);
  console.log(`Bundle sizes (gzip level 6) in ${dir}`);
  console.log(lines.join('\n'));
  if (problems.length) {
    console.error(`\nFAIL\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('\nOK: within budget');
}
