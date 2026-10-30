import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CDN_BASE } from '../src/config.ts';

const root = (...p: string[]) => resolve(import.meta.dirname, '..', '..', ...p);
const read = (...p: string[]) => readFileSync(root(...p), 'utf8');
const headers = read('docker', 'security-headers.conf');
const csp = headers.match(/add_header Content-Security-Policy "([^"]+)"/)?.[1] ?? '';
const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';

describe('nginx security headers (docker/security-headers.conf)', () => {
  it('pins the inline script of index.html by hash, so the CSP and the script cannot drift apart', () => {
    const inline = [...read('web', 'index.html').matchAll(/<script>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    expect(inline).toHaveLength(1);
    const hash = createHash('sha256').update(inline[0]).digest('base64');
    expect(directive('script-src')).toContain(`'sha256-${hash}'`);
  });

  it('does not allow inline or eval script, or any CDN other than the station host', () => {
    expect(directive('script-src')).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    expect(csp).not.toMatch(/unsafe-eval|\*/);
    const hosts = [...csp.matchAll(/https?:\/\/[^\s;]+/g)].map((m) => m[0]);
    expect(new Set(hosts)).toEqual(new Set([CDN_BASE]));
  });

  it('lets the player work: CDN for metadata/HLS/cover, blob: for MediaSource and the hls.js worker', () => {
    expect(directive('connect-src')).toContain(CDN_BASE);
    expect(directive('img-src')).toContain(CDN_BASE);
    expect(directive('media-src')).toContain('blob:');
    expect(directive('media-src')).toContain('data:'); // hls.js adds a dummy data:,WEBVTT text track
    expect(directive('worker-src')).toContain('blob:');
  });

  it('forbids framing, plugins and a changed base URL', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('base-uri')).toBe("base-uri 'self'");
  });

  it('sets the other headers on every response, errors included', () => {
    for (const h of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']) {
      expect(headers).toMatch(new RegExp(`add_header ${h} "[^"]+" always;`));
    }
    expect([...headers.matchAll(/^add_header .* always;$/gm)]).toHaveLength(6);
  });

  it('is included in every production location that sets headers (add_header in a location drops inherited ones)', () => {
    const template = read('docker', 'nginx.conf.template');
    const locations = [...template.matchAll(/^ {4}location (?!=).*\{\n[\s\S]*?^ {4}\}/gm)].map((m) => m[0]);
    expect(locations.length).toBeGreaterThanOrEqual(3); // /assets/, /, /api/
    for (const loc of locations) expect(loc).toContain('include /etc/nginx/security-headers.conf;');
  });

  it('is shipped in the web image and included by the host nginx config', () => {
    expect(read('Dockerfile')).toContain('COPY docker/security-headers.conf /etc/nginx/security-headers.conf');
    expect(read('dev', 'nginx', 'nginx.conf')).toContain('include SECURITYHEADERS;');
    expect(read('bin', 'start.sh')).toContain('SECURITYHEADERS|$PROJECT/docker/security-headers.conf');
  });
});
