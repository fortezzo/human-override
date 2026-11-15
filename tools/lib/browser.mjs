// Shared helper for the screenshot, performance and end-to-end scripts:
// launches the Playwright test browser with the real GPU enabled, so the
// game renders the same way it does for a player.
//
// The test browser lives inside node_modules (not in a system folder). To
// install it:  PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium

// Playwright decides where to look for its browser when it is first loaded,
// so this must be set before the import below.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
const { chromium } = await import('playwright');

/**
 * `capped: true` leaves the browser's usual frame-rate limit on (60 frames
 * a second), which is how a player sees the game. The default runs with the
 * limit off, to measure how fast the game could go.
 */
export async function launch({ width = 1600, height = 900, headless = true, capped = false } = {}) {
  const browser = await chromium.launch({
    headless,
    channel: 'chromium', // full Chromium ("new headless"), which can use the GPU
    args: [
      '--use-angle=d3d11',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      ...(capped ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit']),
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
    ],
  });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  return { browser, context, page };
}

/** Name of the graphics adapter the page is really using. */
export async function gpuName(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'no webgl2';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
}
