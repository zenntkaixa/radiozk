import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CDN_BASE, METADATA_URL } from '../src/config.ts';
import { NAMES } from '../scripts/render-config.mjs';

const web = (...p: string[]) => resolve(import.meta.dirname, '..', ...p);
const html = readFileSync(web('index.html'), 'utf8');
const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);

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
    const touch = links.find((l) => /rel="apple-touch-icon"/.test(l))?.match(/href="([^"]+)"/)?.[1];
    expect(() => readFileSync(web('public', (touch ?? '').replace(/^\//, '')))).not.toThrow();
  });

  it('has link-preview tags with absolute URLs on the static site\'s host, and the image exists', () => {
    const meta = (key: string) => html.match(new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`))?.[1];
    const site = `https://${NAMES.web}.onrender.com/`;
    expect(meta('description')?.length).toBeGreaterThan(50);
    expect(meta('og:url')).toBe(site);
    expect(meta('og:image')).toBe(`${site}og.png`);
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(() => readFileSync(web('public', 'og.png'))).not.toThrow();
  });

  it('ships a robots.txt and a sitemap.xml for the static site\'s host, as real files (not the SPA fallback)', () => {
    const site = `https://${NAMES.web}.onrender.com/`;
    const robots = readFileSync(web('public', 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${site}sitemap.xml`);
    const locs = [...readFileSync(web('public', 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([site, `${site}about`, `${site}whats-new`]);
  });

  it('links a web app manifest whose icons exist in public/', () => {
    expect(links.some((l) => /rel="manifest"\s+href="\/manifest\.webmanifest"/.test(l))).toBe(true);
    const m = JSON.parse(readFileSync(web('public', 'manifest.webmanifest'), 'utf8'));
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']); // maskable: full-bleed, glyph inside the safe zone
    for (const i of m.icons) expect(() => readFileSync(web('public', i.src.replace(/^\//, '')))).not.toThrow();
  });

  it('starts the metadata request early, for the same URL as the poll in nowPlaying.ts', () => {
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');
    expect(inline).toContain('window.__earlyMetadata');
    expect(inline).toContain(`fetch('${METADATA_URL}'`);
    expect(inline).toContain("cache: 'no-store'");
  });
});
