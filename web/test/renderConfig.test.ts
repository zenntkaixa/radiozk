import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { NAMES, buildRenderYaml } from '../scripts/render-config.mjs';

const root = (...p: string[]) => resolve(import.meta.dirname, '..', '..', ...p);
const read = (...p: string[]) => readFileSync(root(...p), 'utf8');
const conf = read('docker', 'security-headers.conf');
const text = read('render.yaml');
const blueprint = parse(text);

type Env = { key: string; value?: string; fromDatabase?: { name: string; property: string } };
type Service = { name: string; runtime: string; region?: string; rootDir?: string; envVars: Env[]; healthCheckPath?: string; staticPublishPath?: string; headers?: { path: string; name: string; value: string }[]; routes?: { type: string; source: string; destination: string }[] };
const services: Service[] = blueprint.services;
const api = services.find((s) => s.name === NAMES.api)!;
const web = services.find((s) => s.name === NAMES.web)!;
const env = (s: Service, key: string) => s.envVars.find((e) => e.key === key);

describe('render.yaml', () => {
  it('is what scripts/render-config.mjs generates (run `npm run render:config` after editing docker/security-headers.conf)', () => {
    expect(text).toBe(buildRenderYaml(conf));
  });

  it('defines the database, the API and the static site, and wires the API to the database', () => {
    expect(blueprint.databases.map((d: { name: string }) => d.name)).toEqual([NAMES.db]);
    expect(api.runtime).toBe('node');
    expect(web.runtime).toBe('static');
    expect(env(api, 'DATABASE_URL')?.fromDatabase).toEqual({ name: NAMES.db, property: 'connectionString' });
  });

  it('puts the database and the API in the same region (it cannot be changed later)', () => {
    expect(blueprint.databases[0].region).toBe(api.region);
  });

  it('configures the API for Render: bind to all interfaces, trust the one proxy hop, health check on a real route', () => {
    expect(env(api, 'HOST')?.value).toBe('0.0.0.0');
    expect(env(api, 'TRUST_PROXY')?.value).toBe('1');
    expect(api.healthCheckPath).toBe('/api/health');
    expect(read('app', 'src', 'server.js')).toContain("'/api/health'");
    expect(existsSync(root('app', 'package-lock.json'))).toBe(true); // `npm ci` needs it
    expect(read('app', 'src', 'server.js')).toContain('process.env.PORT'); // Render's port
  });

  it('carries exactly the nginx security headers, plus immutable caching for hashed assets', () => {
    const fromConf = [...conf.matchAll(/^add_header (\S+) "([^"]+)" always;$/gm)].map((m) => [m[1], m[2]]);
    expect(fromConf).toHaveLength(6);
    const security = web.headers!.filter((h) => h.path === '/*').map((h) => [h.name, h.value]);
    expect(security).toEqual(fromConf);
    expect(web.headers!.find((h) => h.path === '/assets/*')).toEqual({ path: '/assets/*', name: 'Cache-Control', value: 'public, max-age=31536000, immutable' });
  });

  it('proxies /api to the API service before the favicon and SPA rules, so the order matters', () => {
    const routes = web.routes!;
    expect(routes.map((r) => r.source)).toEqual(['/api/*', '/favicon.ico', '/*']);
    expect(routes.every((r) => r.type === 'rewrite')).toBe(true);
    // the onrender.com subdomain is the service name; renaming one without the other would break the proxy
    expect(routes[0].destination).toBe(`https://${NAMES.api}.onrender.com/api/*`);
    expect(routes[2].destination).toBe('/index.html');
  });

  it('publishes the directory Vite writes to and builds with the same Node as the API', () => {
    expect(read('web', 'vite.config.ts')).toContain(`outDir: '../${web.staticPublishPath!.replace('./', '')}'`);
    expect(env(web, 'NODE_VERSION')?.value).toBe(env(api, 'NODE_VERSION')?.value);
  });
});
