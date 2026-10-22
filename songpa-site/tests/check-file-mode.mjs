import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';
import { projectPath, entryHtml } from '../scripts/paths.mjs';

const code = fs.readFileSync(projectPath('dist/client/file-mode.js'), 'utf8');
const html = fs.readFileSync(entryHtml, 'utf8');
assert(!html.includes('document.body.replaceChildren()'), 'Opening a file must preserve the game UI');
assert(html.indexOf('file-mode.js') < html.indexOf('platform/browser.js'), 'File runtime loads before game scripts');
const factory = new IDBFactory();
const context = vm.createContext({
  window: { POKETOUR_CONFIG: { storageMode: 'browser', allowDebug: true }, addEventListener() {} },
  location: { protocol: 'file:' }, document: { baseURI: 'file:///C:/Game%20Files/assets/', addEventListener() {}, removeEventListener() {} },
  indexedDB: factory, URL, Response, structuredClone, crypto, AbortSignal, performance,
  fetch: () => { throw Error('Local play attempted a network request'); },
});
vm.runInContext(code, context);
assert(context.window.PoketourFileRuntime);
vm.runInContext(fs.readFileSync(projectPath('dist/client/platform/browser.js'), 'utf8'), context);
const platform = context.window.PoketourPlatform;
assert.equal((await (await context.fetch('./pokemon-data.json')).json()).report.species, 1025);
assert.equal((await context.fetch('./missing.json')).status, 404);
assert.equal((await context.fetch('../pokemon-data.json')).status, 404);
let current = await (await platform.apiFetch('/api/state')).json();
const call = async (action, payload = {}, endpoint = '/api/action') => {
  const response = await platform.apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ action, payload, revision: current.revision, requestId: crypto.randomUUID() }) });
  current = await response.json();
  assert.equal(response.status, 200, current.error);
  return current;
};
await call('demo');
await call('starter', { id: 749 });
assert.equal(current.state.starter, 749);
assert.equal(platform.allowDebug,true);
await call('debug-spawn');
assert.equal(current.state.fieldWilds.length,1);
await call('route', { id: 'park-olympic', mode: 'walk' }, '/api/route');
assert.equal(current.plan.routingMethod, 'songpa-a-star');
await call('start', { token: current.plan.token });
assert(current.state.travel);
await call('cancel');
const backup = await platform.backup();
const reopened = await context.window.PoketourFileRuntime.createBrowserStore();
const recovered = await (await reopened.request('/api/state')).json();
assert.deepEqual(recovered.state.player, JSON.parse(JSON.stringify(backup.state.player)));
assert.equal(recovered.state.companionUid, backup.state.companionUid);
await platform.restore(backup);
reopened.close();
const https = vm.createContext({ window: {}, location: { protocol: 'https:' } });
vm.runInContext(code, https);
assert(!https.window.PoketourFileRuntime, 'HTTP play retains normal modules');
console.log('PASS file-mode bundle: local data without network/module imports, platform startup, starter, A* route, travel, IndexedDB reopening and backup/restore (VM, not visual browser verification)');
