import { defineConfig } from 'vitest/config';

// `base: './'` makes every built path relative, so the finished site works
// from any folder address (for example a GitHub Pages project page).
export default defineConfig({
  base: './',
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
