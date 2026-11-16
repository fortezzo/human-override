import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fillSiteAddress, parseSiteAddress } from '../tools/lib/site-address.mjs';

// The tags that tell LinkedIn, Slack and the rest what to show for a shared
// link need the page's full address. It is written once, in
// site-address.txt, and filled into index.html when the site is built.

describe("the page's public address", () => {
  it('is the first line of the file that is not a comment, with a slash on the end', () => {
    expect(parseSiteAddress('# a note\n\nhttps://example.github.io/human-override\n')).toBe('https://example.github.io/human-override/');
    expect(parseSiteAddress('https://example.github.io/human-override/\r\n# later\n')).toBe('https://example.github.io/human-override/');
  });

  it('is nothing when the file holds only its notes', () => {
    expect(parseSiteAddress('# The public address of the game, once it has one.\n#\n')).toBe('');
    expect(parseSiteAddress('')).toBe('');
  });

  it('refuses something that is not a web address, before it gets into the page', () => {
    expect(() => parseSiteAddress('my site')).toThrow(/not a web address/);
    expect(() => parseSiteAddress('example.github.io/human-override')).toThrow(/https/);
  });

  it('is filled in everywhere the page asks for it; with none, the picture is looked for next to the page', () => {
    const html = '<meta property="og:url" content="%SITE_URL%" /><meta property="og:image" content="%SITE_URL%social-preview.jpg" />';
    expect(fillSiteAddress(html, 'https://example.github.io/human-override/')).toBe('<meta property="og:url" content="https://example.github.io/human-override/" /><meta property="og:image" content="https://example.github.io/human-override/social-preview.jpg" />');
    expect(fillSiteAddress(html, '')).toBe('<meta property="og:url" content="./" /><meta property="og:image" content="./social-preview.jpg" />');
  });
});

describe('the page itself', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const meta = (key: string): string | null => html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`))?.[1] ?? null;

  it('has a title and a description that say what it is', () => {
    expect(html).toMatch(/<title>HUMAN OVERRIDE[^<]+<\/title>/);
    expect(meta('description')!.length).toBeGreaterThan(80);
    expect(meta('description')!.length).toBeLessThan(260);
  });

  it('tells other sites what to show when the link is shared: a title, a description, and a picture 1200 by 630', () => {
    for (const key of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) expect(meta(key), key).toBeTruthy();
    expect(meta('og:image')).toBe('%SITE_URL%social-preview.jpg');
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
  });

  it('has its icons, and they are files that exist', () => {
    const icons = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="\.\/([^"]+)"/g)].map((match) => match[1]!);
    expect(icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of icons) expect(fs.existsSync(`public/${icon}`), icon).toBe(true);
  });

  it('says nothing about debugging or testing', () => {
    expect(html).not.toMatch(/debug|test|localhost|127\.0\.0\.1|TODO/i);
  });
});
