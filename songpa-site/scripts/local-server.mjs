import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { projectPath } from './paths.mjs';
import { openLocalDatabase } from './local-db.mjs';
import { createStaticAssets } from './static-assets.mjs';

export async function startLocalServer({ port = 5173, userId = 'local-developer', dbFile = projectPath('.local/game.sqlite') } = {}) {
  if (process.env.NODE_ENV === 'production') throw Error('Local development authentication is disabled in production.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid local port');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(userId)) throw Error('Invalid local development user');
  const { default: app } = await import(pathToFileURL(projectPath('dist/server/index.js')).href);
  const local = openLocalDatabase(dbFile);
  const env = { DB: local.DB, ASSETS: createStaticAssets(projectPath('dist/client')), resolveUser:()=>userId };
  let origin;
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      const host = incoming.headers.host;
      const expected = new URL(origin).host;
      // Loopback binding plus exact Host validation blocks DNS rebinding/LAN exposure.
      if (host !== expected) { outgoing.writeHead(403).end('Local host required'); return; }
      if (incoming.headers.origin && incoming.headers.origin !== origin) { outgoing.writeHead(403).end('Same origin required'); return; }
      const target = new URL(incoming.url, origin);
      if (target.origin !== origin) { outgoing.writeHead(403).end('Local target required'); return; }
      const chunks = [];
      let length = 0;
      for await (const chunk of incoming) {
        length += chunk.length;
        if (length > 16000) { outgoing.writeHead(413).end('Request too large'); return; }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value !== undefined && key !== 'host') headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      // Incoming user headers are ignored; this identity exists only in this local Node adapter.
      const method = incoming.method;
      const request = new Request(target, { method, headers, ...(!['GET', 'HEAD'].includes(method) ? { body: Buffer.concat(chunks) } : {}) });
      const url = new URL(request.url);
      let response;
      if (url.pathname === '/runtime-config.js' && ['GET', 'HEAD'].includes(method)) {
        const config = `window.POKETOUR_CONFIG = Object.freeze(${JSON.stringify({ storageMode:'server', apiBaseUrl: '', auth: { loginUrl: '/', loginLabel: '로컬 개발 계정' } })});\n`;
        response = new Response(method === 'HEAD' ? null : config, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' } });
      } else response = await app.fetch(request, env);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('Local request failed:', error.message);
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'text/plain' });
      outgoing.end('Local server error');
    }
  });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  } catch (error) { local.close(); throw error; }
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin, server, dbFile,
    async close() {
      await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
      local.close();
    },
  };
}
