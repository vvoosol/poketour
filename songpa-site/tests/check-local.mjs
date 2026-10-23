import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { startLocalServer } from '../scripts/local-server.mjs';
import { openLocalDatabase } from '../scripts/local-db.mjs';
import { projectPath, entryHtml } from '../scripts/paths.mjs';
import { createStaticAssets } from '../scripts/static-assets.mjs';
import worker from '../dist/server/index.js';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'poketour-local-'));
assert(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep + 'poketour-local-'));
const dbFile = path.join(temporary, 'game.sqlite');
let runtime;
try {
  const previousMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try { await assert.rejects(startLocalServer({ port: 0, dbFile }), /disabled in production/); }
  finally { if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode; }

  const local = openLocalDatabase(dbFile);
  try {
    // A failed second statement must roll back the earlier write as in D1 batch.
    await assert.rejects(local.DB.batch([
      local.DB.prepare('INSERT INTO world_cache (key,value,updated_at) VALUES (?,?,?)').bind('rollback-test', '{}', 0),
      local.DB.prepare('INSERT INTO table_that_does_not_exist VALUES (?)').bind('fail'),
    ]));
    assert.equal(await local.DB.prepare('SELECT value FROM world_cache WHERE key=?').bind('rollback-test').first(), null);
    const response = await worker.fetch(new Request('https://production.example/api/state'), {
      DB: local.DB, ASSETS: createStaticAssets(projectPath('dist/client')), DEV_AUTH: true, POKETOUR_DEV_USER: 'attacker',
    });
    assert.equal(response.status, 401, 'Production Worker cannot enable local auth through environment flags');
  } finally { local.close(); }

  runtime = await startLocalServer({ port: 0, dbFile });
  const getState = async () => {
    const response = await fetch(runtime.origin + '/api/state');
    assert.equal(response.status, 200);
    return response.json();
  };
  let state = await getState();
  assert.equal(state.revision, 0);
  const post = async (action, payload = {}, requestId = crypto.randomUUID(), revision = state.revision) => {
    const response = await fetch(runtime.origin + '/api/action', {
      method: 'POST', headers: { Origin: runtime.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision, requestId, action, payload }),
    });
    const result = await response.json();
    assert.equal(response.status, 200, result.error);
    state = result;
    return result;
  };
  await post('demo');
  await post('starter', { id: 749 }, 'local-starter');
  const saved = structuredClone(state.state);
  const savedRevision = state.revision;
  const replayed = await post('starter', { id: 749 }, 'local-starter', 0);
  assert.equal(replayed.replayed, true);
  assert.deepEqual(replayed.state, saved);
  const spoof = await fetch(runtime.origin + '/api/state', { headers: { 'x-poketour-user': 'someone-else' } });
  assert.deepEqual((await spoof.json()).state, saved, 'Client identity header cannot change local user');
  assert.equal((await fetch(runtime.origin + '/api/action', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' })).status, 403);
  assert.equal((await fetch(runtime.origin + '/api/action', { method: 'POST', headers: { Origin: runtime.origin }, body: 'x'.repeat(16001) })).status, 413);
  const badHost = await new Promise((resolve, reject) => {
    const request = http.get(runtime.origin, { headers: { Host: 'rebind.example' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
  assert.equal(badHost, 403);
  const remoteTarget = await new Promise((resolve, reject) => {
    const request = http.request(runtime.origin, { path: 'http://outside.example/api/state' }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end();
  });
  assert.equal(remoteTarget, 403);
  for (const route of ['/server/index.js', '/.local/game.sqlite', '/%2e%2e%2fscripts/local-server.mjs']) {
    assert.equal((await fetch(runtime.origin + route)).status, 404, route);
  }
  const home = await fetch(runtime.origin);
  const html = await home.text();
  assert.equal(home.status, 200);
  for (const [, asset] of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^" ]*)?"/g)) {
    assert.equal((await fetch(runtime.origin + '/' + asset)).status, 200, asset);
  }
  const head = await fetch(runtime.origin + '/neodgm.woff2', { method: 'HEAD' });
  assert.equal(head.headers.get('content-type'), 'font/woff2');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.match(await (await fetch(runtime.origin + '/runtime-config.js')).text(), /로컬 개발 계정/);

  await runtime.close(); runtime = null;
  runtime = await startLocalServer({ port: 0, dbFile });
  const recovered = await getState();
  assert.equal(recovered.revision, savedRevision);
  assert.deepEqual(recovered.state, saved, 'Saved UID, location, party, inventory and progress survive server restart');
  await runtime.close(); runtime = null;
  runtime = await startLocalServer({ port: 0, dbFile, userId: 'second-developer' });
  assert.equal((await getState()).state.starter, null);
  await runtime.close(); runtime = null;
  console.log('PASS local HTTP: starter/save/replay, restart persistence, account separation, Host/Origin/body limits, private files, assets and production auth refusal');

  const events = {};
  const calls = [];
  const context = vm.createContext({
    window: { POKETOUR_CONFIG: { apiBaseUrl: 'https://api.example' }, addEventListener: (event, fn) => { events[event] = fn; } },
    document: { hidden: false, addEventListener: (event, fn) => { events[event] = fn; }, removeEventListener() {} },
    fetch: (...args) => { calls.push(args); return Promise.resolve(new Response('{}')); },
    navigator: { geolocation: { watchPosition: () => 7, clearWatch: () => {} } }, URL,
  });
  vm.runInContext(fs.readFileSync(projectPath('src/platform/browser.js'), 'utf8'), context);
  await context.window.PoketourPlatform.apiFetch('/api/state');
  assert.equal(calls[0][0], 'https://api.example/api/state');
  assert.equal(context.window.PoketourPlatform.location.watchPosition(() => {}), 7);
  let resumed = 0;
  context.window.PoketourPlatform.lifecycle.onResume(() => resumed++);
  context.document.hidden = true; events.visibilitychange(); assert.equal(resumed, 0);
  context.document.hidden = false; events.visibilitychange(); assert.equal(resumed, 1);
  assert.throws(() => context.window.createPoketourPlatform({ config: { apiBaseUrl: 'http://api.example' } }), /HTTPS/);
  console.log('PASS platform: API base URL, location provider and resume adapter');

  const report = JSON.parse(fs.readFileSync(projectPath('dist/build-report.json')));
  assert.equal(fs.readFileSync(projectPath('dist/client/index.html'), 'utf8'), fs.readFileSync(entryHtml, 'utf8').replace(/  <base href="\.\/assets\/" data-poketour-assets>\r?\n/, ''), 'Built entry preserves root game HTML with flat asset paths');
  for (const file of [...report.assets, ...report.serverFiles]) {
    assert.equal(createHash('sha256').update(fs.readFileSync(projectPath('dist', file.path))).digest('hex'), file.sha256, file.path);
  }
  assert(report.assets.some(file => file.path.endsWith('foot-graph.json')));
  assert(!fs.readFileSync(projectPath('dist/server/worker.js'), 'utf8').includes('local-developer'));
  console.log('PASS output integrity: file hashes, browser graph, no local auth in Worker');
} finally {
  if (runtime) await runtime.close();
  fs.rmSync(temporary, { recursive: true, force: true });
}
