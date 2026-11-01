import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildVercelConfig } from '../scripts/vercel-config.mjs';

const root = (...p: string[]) => resolve(import.meta.dirname, '..', '..', ...p);
const read = (...p: string[]) => readFileSync(root(...p), 'utf8');
const config = JSON.parse(read('vercel.json'));
const conf = read('docker', 'security-headers.conf');

describe('vercel.json', () => {
  it('is what scripts/vercel-config.mjs generates (run `npm run vercel:config` after editing docker/security-headers.conf)', () => {
    expect(config).toEqual(buildVercelConfig(conf));
  });

  it('carries exactly the nginx security headers, on every path', () => {
    const all = config.headers.find((h: { source: string }) => h.source === '/(.*)').headers;
    const fromConf = [...conf.matchAll(/^add_header (\S+) "([^"]+)" always;$/gm)].map((m) => [m[1], m[2]]);
    expect(fromConf).toHaveLength(6);
    expect(all.map((h: { key: string; value: string }) => [h.key, h.value])).toEqual(fromConf);
  });

  it('caches hashed assets forever and revalidates the HTML, like nginx', () => {
    const rule = (source: string) => config.headers.find((h: { source: string }) => h.source === source).headers[0];
    expect(rule('/assets/(.*)')).toEqual({ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' });
    expect(rule('/(index\\.html)?').value).toBe('no-cache');
  });

  it('routes /api/* to the function before the SPA fallback, which skips /api and /favicon.ico', () => {
    const [api, spa] = config.rewrites;
    expect(api).toEqual({ source: '/api/(.*)', destination: '/api' });
    const fallback = new RegExp(`^${spa.source}$`);
    for (const path of ['/', '/radio', '/some/deep/route']) expect(fallback.test(path)).toBe(true);
    for (const path of ['/api/ratings', '/api/health', '/favicon.ico']) expect(fallback.test(path)).toBe(false);
  });

  it('builds into the directory Vite writes to and points at an existing function entry', () => {
    expect(read('web', 'vite.config.ts')).toContain(`outDir: '../${config.outputDirectory}'`);
    expect(existsSync(root('api', 'index.mjs'))).toBe(true);
    expect(Object.keys(config.functions)).toEqual(['api/index.mjs']);
  });
});
