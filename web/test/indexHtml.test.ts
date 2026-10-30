import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CDN_BASE } from '../src/config.ts';

const web = (...p: string[]) => resolve(import.meta.dirname, '..', ...p);
const html = readFileSync(web('index.html'), 'utf8');
const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);

describe('index.html', () => {
  it('preconnects to the CDN host used by config.ts, with and without CORS', () => {
    const preconnects = links.filter((l) => /rel="preconnect"/.test(l));
    expect(preconnects.every((l) => l.includes(`href="${CDN_BASE}"`))).toBe(true);
    expect(preconnects.filter((l) => /\scrossorigin\b/.test(l))).toHaveLength(1); // fetch/XHR pool
    expect(preconnects.filter((l) => !/\scrossorigin\b/.test(l))).toHaveLength(1); // <img> pool
  });

  it('declares an icon that exists in public/, so browsers do not fall back to /favicon.ico', () => {
    const icon = links.find((l) => /rel="icon"/.test(l));
    const href = icon?.match(/href="([^"]+)"/)?.[1];
    expect(href).toBeTruthy();
    expect(() => readFileSync(web('public', (href ?? '').replace(/^\//, '')))).not.toThrow();
  });
});
