// The page's public address, for the tags that tell other sites what to
// show when the link is shared.
//
// The game itself is built with relative paths and works from any folder.
// A link preview is different: LinkedIn, Slack and the rest fetch the
// picture named in the page's "og:image" tag, and they want a full address
// for it. The one place that address is written down is site-address.txt
// in the project folder; this reads it and fills it into index.html when
// the site is built.

import fs from 'node:fs';

/** The address in the given file's text (the first line that is not a comment), with a slash on the end; '' if there is none. */
export function parseSiteAddress(text) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!/^https?:\/\/[^\s/]+/i.test(trimmed)) throw new Error(`site-address.txt: "${trimmed}" is not a web address (it should start with https://)`);
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }
  return '';
}

/** index.html with every %SITE_URL% filled in: the full address, or './' (next to the page) when there is none yet. */
export function fillSiteAddress(html, address) {
  return html.replaceAll('%SITE_URL%', address || './');
}

/** A Vite plugin that does that at build time (and for the dev server). */
export function siteAddress(file = 'site-address.txt') {
  return {
    name: 'site-address',
    transformIndexHtml(html) {
      const address = fs.existsSync(file) ? parseSiteAddress(fs.readFileSync(file, 'utf8')) : '';
      return fillSiteAddress(html, address);
    },
  };
}
