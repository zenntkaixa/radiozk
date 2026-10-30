// Run: npm run test:parser (in web/). Tests the bundle size budget check on small fake builds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { checkSize, initialFiles } from '../scripts/check-size.mjs';

const html = `<!doctype html><html><head>
<link rel="icon" href="/favicon.svg"><link rel="preconnect" href="https://cdn.example">
<script type="module" crossorigin src="/assets/index-a.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-b.js">
<link rel="stylesheet" crossorigin href="/assets/index-c.css">
</head><body></body></html>`;

// Random bytes do not compress, so the gzip size is about the byte size.
const noise = (kb) => randomBytes(kb * 1024);

function build(files) {
  const dir = mkdtempSync(join(tmpdir(), 'size-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), html);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, 'assets', name), content);
  return dir;
}
const budget = { initialKb: 20, lazyChunkKb: 30 };
const withBuild = (files, fn) => {
  const dir = build(files);
  try { return fn(dir); } finally { rmSync(dir, { recursive: true }); }
};

test('initialFiles lists scripts, modulepreloads and stylesheets, not icons or preconnects', () => {
  assert.deepEqual(initialFiles(html), ['assets/index-a.js', 'assets/vendor-b.js', 'assets/index-c.css']);
});

test('a build within budget passes and lists lazy chunks separately', () => {
  withBuild({ 'index-a.js': noise(5), 'vendor-b.js': noise(5), 'index-c.css': 'a{}', 'hls.light-d.js': noise(10) }, (dir) => {
    const { problems, lines } = checkSize(dir, budget);
    assert.deepEqual(problems, []);
    assert.ok(lines.some((l) => /lazy .*hls\.light-d\.js/.test(l)));
  });
});

test('initial JS+CSS over budget fails', () => {
  withBuild({ 'index-a.js': noise(15), 'vendor-b.js': noise(10), 'index-c.css': 'a{}' }, (dir) => {
    const { problems } = checkSize(dir, budget);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /initial JS\+CSS is .* KB gzipped, over the 20 KB budget/);
  });
});

test('a lazy chunk over its limit fails, naming the file', () => {
  withBuild({ 'index-a.js': noise(1), 'vendor-b.js': noise(1), 'index-c.css': 'a{}', 'big-e.js': noise(40) }, (dir) => {
    const { problems } = checkSize(dir, budget);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /assets\/big-e\.js is .* KB gzipped, over the 30 KB limit/);
  });
});

test('hls.js inside the initial bundle fails even when it is small', () => {
  withBuild({ 'index-a.js': 'const e="hlsManifestParsed";', 'vendor-b.js': 'x', 'index-c.css': 'a{}' }, (dir) => {
    const { problems } = checkSize(dir, budget);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /index-a\.js contains hls\.js/);
  });
});
