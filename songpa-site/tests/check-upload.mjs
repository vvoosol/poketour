import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { entryHtml, projectPath } from '../scripts/paths.mjs';
import { createStaticAssets } from '../scripts/static-assets.mjs';
import { startUploadPreview } from '../scripts/preview-upload.mjs';

const root = path.dirname(entryHtml);
const assets = createStaticAssets(root);
const html = fs.readFileSync(entryHtml, 'utf8');
assert.match(html, /<base href="\.\/assets\/" data-poketour-assets>/);
// A project Pages URL must resolve to the same files as a root-domain URL.
for (const prefix of ['/', '/poketour-play/']) {
  const base = new URL('./assets/', 'https://example.test' + prefix);
  for (const [, ref] of html.replace(/<base\b[^>]*>/, '').matchAll(/(?:src|href)="(\.\/[^"?]+)(?:\?[^" ]*)?"/g)) {
    const url = new URL(ref, base);
    const response = await assets.fetch(new Request('https://example.test/' + url.pathname.slice(prefix.length)));
    assert.equal(response.status, 200, url.href);
  }
}
const report = JSON.parse(fs.readFileSync(projectPath('dist/build-report.json')));
for (const file of report.assets.filter(file => file.path.endsWith('.css'))) {
  const cssFile = path.join(root, 'assets', file.path.replace(/^client\//, ''));
  for (const [, ref] of fs.readFileSync(cssFile, 'utf8').matchAll(/url\(['"]?(\.\/[^)'"?]+)(?:\?[^)'" ]*)?['"]?\)/g)) {
    assert(fs.existsSync(path.resolve(path.dirname(cssFile), ref)), `${file.path}: ${ref}`);
  }
}
for (const file of report.assets) {
  const relative = file.path.replace(/^client\//, '');
  assert.deepEqual(fs.readFileSync(path.join(root, 'assets', relative)), fs.readFileSync(projectPath('dist', file.path)), relative);
}
const runtime = await startUploadPreview({ port: 0 });
try {
  assert.equal((await fetch(runtime.origin)).status, 200);
  for (const ref of ['/assets/platform/browser-store.mjs', '/assets/shared/engine.mjs']) {
    const response = await fetch(runtime.origin + ref);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
  }
  assert.match(await (await fetch(runtime.origin + '/assets/runtime-config.js')).text(), /storageMode:"browser"/);
  assert.equal((await fetch(runtime.origin + '/songpa-site/.local/game.sqlite')).status, 404);
} finally { await runtime.close(); }
console.log('PASS root upload: entry asset paths, Pages subdirectory, all distributed file contents, browser module MIME and static preview');
