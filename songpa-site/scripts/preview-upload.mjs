import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { entryHtml } from './paths.mjs';
import { createStaticAssets } from './static-assets.mjs';

export async function startUploadPreview({ port = 5174 } = {}) {
  const assets = createStaticAssets(path.dirname(entryHtml));
  const server = http.createServer(async (req, res) => {
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      if (req.headers.host !== new URL(origin).host) { res.writeHead(403).end(); return; }
      const url = new URL(req.url, origin);
      if (url.origin !== origin) { res.writeHead(403).end(); return; }
      if (url.pathname.endsWith('/')) url.pathname += 'index.html';
      if (url.pathname !== '/index.html' && !url.pathname.startsWith('/assets/')) { res.writeHead(404).end(); return; }
      const response = await assets.fetch(new Request(url, { method: req.method }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(500).end('Unable to load game files'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtime = await startUploadPreview();
  console.log(`Poketour: ${runtime.origin}`);
  console.log('Open this address in your browser. Keep this window open; Ctrl+C stops the game server.');
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await runtime.close(); process.exit(0); });
}
