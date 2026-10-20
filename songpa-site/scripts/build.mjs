import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { projectRoot, projectPath, entryHtml } from './paths.mjs';

export async function build() {
  // Only the generated output is removed. Authoring files live outside dist.
  const output = projectPath('dist');
  if (path.dirname(output) !== path.resolve(projectRoot)) throw Error('Unsafe build path');
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(projectPath('dist/client'), { recursive: true });
  fs.mkdirSync(projectPath('dist/server/data'), { recursive: true });
  fs.cpSync(projectPath('public'), projectPath('dist/client'), { recursive: true });
  fs.cpSync(projectPath('src/client'), projectPath('dist/client'), { recursive: true });
  fs.cpSync(projectPath('src/platform'), projectPath('dist/client/platform'), { recursive: true });
  fs.copyFileSync(entryHtml, projectPath('dist/client/index.html'));
  fs.writeFileSync(projectPath('dist/client/runtime-config.js'), 'window.POKETOUR_CONFIG = Object.freeze({apiBaseUrl: ""});\n');
  fs.cpSync(projectPath('src/shared'), projectPath('dist/server/shared'), { recursive: true });
  fs.writeFileSync(projectPath('dist/server/worker.js'), fs.readFileSync(projectPath('worker/index.js'), 'utf8').replaceAll('../src/shared/', './shared/'));
  fs.writeFileSync(projectPath('dist/client/engine.js'), fs.readFileSync(projectPath('src/shared/engine.mjs'), 'utf8').replace('export function createEngine', 'window.createEngine = function createEngine'));
  const oldCwd = process.cwd();
  process.chdir(projectRoot);
  try {
    // Cache busting supports multiple builds in one dev-server process.
    const stamp = Date.now();
    await import(`./prepare-world.mjs?build=${stamp}`);
    await import(`./prepare-routing.mjs?build=${stamp}`);
  } finally { process.chdir(oldCwd); }
  for (const name of ['pokemon-data.json', 'game-settings.json', 'world-seed.json', 'facility-evidence.json']) {
    fs.copyFileSync(projectPath('dist/client', name), projectPath('dist/server/data', name));
  }
  const readme = fs.readFileSync(projectPath('README.md'), 'utf8').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  fs.writeFileSync(projectPath('dist/client/README.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Poketour 구현 기록</title><style>body{max-width:860px;margin:auto;padding:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><a href="./">모험으로 돌아가기</a><pre>${readme}</pre></html>`);
  const entry = `import {createWorker} from './worker.js';
import pokemonData from './data/pokemon-data.json' with {type:'json'};
import settings from './data/game-settings.json' with {type:'json'};
import seed from './data/world-seed.json' with {type:'json'};
import evidence from './data/facility-evidence.json' with {type:'json'};
import graph from './data/foot-graph.json' with {type:'json'};
export default createWorker({pokemonData,settings,seed,evidence,loadFootGraph:()=>graph});
`;
  fs.writeFileSync(projectPath('dist/server/index.js'), entry);
  const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(f => f.isDirectory() ? files(path.join(dir, f.name)) : [path.join(dir, f.name)]);
  const measure = file => {
    const bytes = fs.readFileSync(file);
    return { path: path.relative(output, file).replaceAll('\\', '/'), bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: createHash('sha256').update(bytes).digest('hex') };
  };
  const assets = files(projectPath('dist/client')).map(measure);
  const serverFiles = files(projectPath('dist/server')).map(measure);
  const serverJs = serverFiles.filter(f => /\.(mjs|js)$/.test(f.path));
  const report = {
    clientFiles: assets.length,
    clientBytes: assets.reduce((sum, f) => sum + f.bytes, 0),
    serverJavaScriptBytes: serverJs.reduce((sum, f) => sum + f.bytes, 0),
    serverJavaScriptGzipBytes: serverJs.reduce((sum, f) => sum + f.gzipBytes, 0),
    serverDataBytes: serverFiles.filter(f => f.path.endsWith('.json')).reduce((sum, f) => sum + f.bytes, 0),
    note: 'Per-file gzip sizes are measurements, not a hosting bundle-limit guarantee.',
    assets, serverFiles,
  };
  fs.writeFileSync(projectPath('dist/build-report.json'), JSON.stringify(report, null, 2));
  console.log(`Built ${report.clientFiles} client files; server JS ${report.serverJavaScriptBytes} bytes (${report.serverJavaScriptGzipBytes} bytes gzip, per-file sum).`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === projectPath('scripts/build.mjs')) await build();
