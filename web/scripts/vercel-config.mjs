// Generates ../vercel.json from docker/security-headers.conf, so the headers have one source of truth.
//   node scripts/vercel-config.mjs            write ../vercel.json   (npm run vercel:config)
// web/test/vercelConfig.test.ts fails when the committed file differs from what this produces.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function buildVercelConfig(headersConf) {
  const security = [...headersConf.matchAll(/^add_header (\S+) "([^"]+)" always;$/gm)].map(([, key, value]) => ({ key, value }));
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    framework: null,
    installCommand: 'npm ci --prefix app && npm ci --prefix web',
    buildCommand: 'npm run build --prefix web',
    outputDirectory: 'www',
    functions: { 'api/index.mjs': { maxDuration: 10, includeFiles: 'app/src/**' } },
    rewrites: [
      { source: '/api/(.*)', destination: '/api' },
      // SPA fallback for client-side routes, except /api and /favicon.ico (nginx answers that with 204; no .ico is shipped)
      { source: '/((?!api/|favicon\\.ico$).*)', destination: '/index.html' },
    ],
    headers: [
      { source: '/(.*)', headers: security },
      { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/(index\\.html)?', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../../', import.meta.url);
  const conf = readFileSync(new URL('docker/security-headers.conf', root), 'utf8');
  writeFileSync(new URL('vercel.json', root), JSON.stringify(buildVercelConfig(conf), null, 2) + '\n');
  console.log('wrote vercel.json');
}
