// A tiny static file server for testing the production build.
//
// It can mount the site under a sub-path (for example /games/human-override/)
// to prove the build works from any folder address, the way it will be
// served on GitHub Pages.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
};

/**
 * @param {string} root   folder to serve
 * @param {string} prefix URL path the folder is mounted at, e.g. "/sub/folder/"
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export function serve(root, prefix = '/') {
  const mount = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (!url.startsWith(mount)) {
      res.writeHead(404).end('Not found');
      return;
    }
    let file = path.join(root, url.slice(mount.length));
    if (!file.startsWith(path.resolve(root)) && !path.resolve(file).startsWith(path.resolve(root))) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}${mount}`, close: () => new Promise((done) => server.close(done)) });
    });
  });
}
