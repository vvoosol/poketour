import fs from 'node:fs/promises';
import path from 'node:path';

const mime = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2' };

export function createStaticAssets(directory) {
  const root = path.resolve(directory);
  return { async fetch(request) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    let relative;
    try { relative = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '') || 'index.html'; }
    catch { return new Response('Bad path', { status: 400 }); }
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root + path.sep) || relative.split(/[\\/]/).some(p => p.startsWith('.'))) return new Response('Not found', { status: 404 });
    try {
      const actual = await fs.realpath(filename);
      if (!actual.startsWith(root + path.sep)) return new Response('Not found', { status: 404 });
      const data = await fs.readFile(actual);
      return new Response(request.method === 'HEAD' ? null : data, { headers: {
        'Content-Type': mime[path.extname(filename).slice(1)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(self)',
      } });
    } catch (error) {
      if (['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) return new Response('Not found', { status: 404 });
      throw error;
    }
  } };
}
