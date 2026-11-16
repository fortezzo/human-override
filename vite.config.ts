import { defineConfig } from 'vitest/config';
import { siteAddress } from './tools/lib/site-address.mjs';

// `base: './'` makes every built path relative, so the finished site works
// from any folder address (for example a GitHub Pages project page).
export default defineConfig({
  base: './',
  // (Fills the page's public address into the tags other sites read when the link is shared: see site-address.txt.)
  plugins: [siteAddress()],
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
