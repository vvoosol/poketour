import fs from 'node:fs';
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',txt:'text/plain; charset=utf-8',png:'image/png',svg:'image/svg+xml',woff2:'font/woff2'};
const assets={};
const readme=fs.readFileSync('README.md','utf8').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
fs.writeFileSync('dist/README.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>송파 모험지도 구현 기록</title><style>body{font:15px/1.75 system-ui;background:#f3f5e9;color:#19352d;max-width:860px;margin:auto;padding:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}a{color:#285633}</style><a href="./">모험으로 돌아가기</a><pre>${readme}</pre></html>`);
fs.writeFileSync('dist/engine.js',fs.readFileSync('engine.mjs','utf8').replace('export function createEngine','window.createEngine = function createEngine'));
for(const f of fs.readdirSync('dist',{withFileTypes:true})){if(!f.isFile())continue;assets[f.name]={type:mime[f.name.split('.').at(-1)]||'application/octet-stream',data:fs.readFileSync('dist/'+f.name).toString('base64')};}
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
const shared=['engine.mjs','routing.mjs','world.mjs'].map(f=>fs.readFileSync(f,'utf8').replaceAll('export function','function').replaceAll('export async function','async function')).join('\n');
fs.writeFileSync('dist/server/index.js',shared+'\n'+fs.readFileSync('worker/index.js','utf8')+'\nexport default createWorker('+JSON.stringify(assets)+');\n');
fs.writeFileSync('dist/engine.js',fs.readFileSync('engine.mjs','utf8').replace('export function createEngine','window.createEngine = function createEngine'));
fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Worker + '+Object.keys(assets).length+' static assets built.');
