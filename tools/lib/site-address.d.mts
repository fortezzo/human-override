// Types for site-address.mjs, so that vite.config.ts and the tests can import it.
export function parseSiteAddress(text: string): string;
export function fillSiteAddress(html: string, address: string): string;
export function siteAddress(file?: string): { name: string; transformIndexHtml(html: string): string };
