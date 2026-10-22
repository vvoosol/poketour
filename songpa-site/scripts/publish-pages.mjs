import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {projectPath,projectRoot} from './paths.mjs';

const repository='vvoosol/poketour-play';
const checkout=projectPath('.pages-publish');
const run=(command,args,cwd=projectRoot)=>{
  const result=spawnSync(command,args,{cwd,encoding:'utf8',windowsHide:true});
  if(result.status!==0) throw Error(`${command} failed: ${result.stderr || result.stdout || result.error}`);
  return result.stdout.trim();
};
if(run('git',['status','--porcelain'])) throw Error('Commit and push the source changes before publishing.');
const commit=run('git',['rev-parse','HEAD']);
const branch=run('git',['branch','--show-current']);
const upstream=run('git',['ls-remote','origin',`refs/heads/${branch}`]).split(/\s/)[0];
if(upstream!==commit) throw Error('Push the current source commit before publishing.');
const report=JSON.parse(fs.readFileSync(projectPath('dist/build-report.json'),'utf8'));
for(const file of report.assets){
  const absolute=projectPath('dist',file.path);
  if(createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')!==file.sha256) throw Error('Build output changed: '+file.path);
}
if(!fs.readFileSync(projectPath('dist/client/runtime-config.js'),'utf8').includes('storageMode:"browser"')) throw Error('Pages requires the browser-only build.');
if(!checkout.startsWith(path.resolve(projectRoot)+path.sep)) throw Error('Unsafe publish path');
if(!fs.existsSync(path.join(checkout,'.git'))){
  run('git',['clone','--quiet',`https://github.com/${repository}.git`,checkout]);
} else run('git',['pull','--ff-only','origin','main'],checkout);
const remote=run('git',['remote','get-url','origin'],checkout);
if(remote!==`https://github.com/${repository}.git`) throw Error('Unexpected deployment repository');
for(const entry of fs.readdirSync(checkout)){
  if(entry==='.git') continue;
  const target=path.join(checkout,entry);
  if(path.dirname(target)!==checkout) throw Error('Unsafe artifact cleanup path');
  fs.rmSync(target,{recursive:true,force:true});
}
for(const file of report.assets){
  if(!file.path.startsWith('client/')) throw Error('Unexpected client artifact path');
  const relative=file.path.slice('client/'.length);
  const destination=path.resolve(checkout,relative);
  if(!destination.startsWith(checkout+path.sep)) throw Error('Unsafe client artifact path');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(projectPath('dist',file.path),destination);
}
fs.writeFileSync(path.join(checkout,'release.json'),JSON.stringify({sourceCommit:commit,storageMode:'browser'},null,2));
fs.writeFileSync(path.join(checkout,'README.md'),'# Poketour\n\nGitHub Pages에 배포하는 게임 실행 파일입니다. 루트 index.html이 진입점입니다. 로그인 없이 플레이하며 진행도는 각 브라우저에 저장됩니다.\n');
for(const key of ['user.name','user.email']) run('git',['config',key,run('git',['config',key])],checkout);
run('git',['add','--all'],checkout);
if(run('git',['status','--porcelain'],checkout)){
  run('git',['commit','--quiet','-m',`Publish Poketour ${commit.slice(0,7)}`],checkout);
  run('git',['push','-u','origin','HEAD:main'],checkout);
}
console.log(`Published static artifacts to https://github.com/${repository}`);
console.log('Deployment commit: '+run('git',['rev-parse','HEAD'],checkout));
console.log('Source commit: '+commit);
