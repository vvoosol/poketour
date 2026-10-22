import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build as bundle } from 'esbuild';
import { projectRoot, projectPath, entryHtml } from './paths.mjs';

export async function build() {
  // Only the generated output is removed. Authoring files live outside dist.
  const output = projectPath('dist');
  if (path.dirname(output) !== path.resolve(projectRoot)) throw Error('Unsafe build path');
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(projectPath('dist/client'), { recursive: true });
  fs.mkdirSync(projectPath('dist/server/data'), { recursive: true });
  fs.cpSync(projectPath('public'), projectPath('dist/client'), { recursive: true });
  fs.copyFileSync(projectPath('source-data/PokeAPI-LICENSE.md'),projectPath('dist/client/PokeAPI-LICENSE.md'));
  fs.cpSync(projectPath('src/client'), projectPath('dist/client'), { recursive: true });
  fs.cpSync(projectPath('src/platform'), projectPath('dist/client/platform'), { recursive: true });
  fs.cpSync(projectPath('src/shared'), projectPath('dist/client/shared'), { recursive: true });
  const html = fs.readFileSync(entryHtml, 'utf8').replace(/  <base href="\.\/assets\/" data-poketour-assets>\r?\n/, '');
  fs.writeFileSync(projectPath('dist/client/index.html'), html);
  fs.writeFileSync(projectPath('dist/client/runtime-config.js'), 'window.POKETOUR_CONFIG = Object.freeze({storageMode:"browser",apiBaseUrl:"",allowDebug:true});\n');
  fs.writeFileSync(projectPath('dist/client/.nojekyll'), '');
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
  fs.copyFileSync(projectPath('dist/server/data/foot-graph.json'), projectPath('dist/client/foot-graph.json'));
  const fileData = Object.fromEntries(['pokemon-data.json', 'game-settings.json', 'world-seed.json', 'facility-evidence.json', 'foot-graph.json', 'songpa-osm.json', 'base-style.json'].map(name => [name, fs.readFileSync(projectPath('dist/client', name), 'utf8')]));
  await bundle({
    entryPoints: [projectPath('src/platform/file-runtime.mjs')],
    outfile: projectPath('dist/client/file-mode.js'),
    bundle: true, format: 'iife', platform: 'browser', target: 'es2022',
    define: { 'import.meta.url': 'document.baseURI' },
    banner: { js: 'window.POKETOUR_FILE_DATA=' + JSON.stringify(fileData) + ';' },
  });
  for (const name of ['pokemon-data.json', 'game-settings.json', 'world-seed.json', 'facility-evidence.json']) {
    fs.copyFileSync(projectPath('dist/client', name), projectPath('dist/server/data', name));
  }
  fs.writeFileSync(projectPath('dist/client/README.html'), '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Poketour 도움말</title><h1>Poketour</h1><p>로그인 없이 플레이할 수 있습니다. 진행도는 이 브라우저에 저장됩니다. 메뉴에서 저장 파일을 내려받아 백업하세요. 브라우저 데이터를 지우면 진행도가 사라질 수 있습니다.</p><a href="./">게임으로 돌아가기</a></html>');
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
  // Keep the repository root directly publishable without a hosting build step.
  const uploadAssets = path.resolve(path.dirname(entryHtml), 'assets');
  if (path.dirname(uploadAssets) !== path.dirname(entryHtml) || path.basename(uploadAssets) !== 'assets') throw Error('Unsafe upload path');
  fs.mkdirSync(uploadAssets, { recursive: true });
  fs.cpSync(projectPath('dist/client'), uploadAssets, { recursive: true });
  console.log(`Built ${report.clientFiles} client files; server JS ${report.serverJavaScriptBytes} bytes (${report.serverJavaScriptGzipBytes} bytes gzip, per-file sum).`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === projectPath('scripts/build.mjs')) await build();
