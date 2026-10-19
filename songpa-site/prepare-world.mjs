import fs from 'node:fs';import vm from 'node:vm';
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/game-config.js','utf8'),ctx);vm.runInContext(fs.readFileSync('dist/game-core.js','utf8'),ctx);
const data=JSON.parse(fs.readFileSync('dist/songpa-osm.json')),proof=JSON.parse(fs.readFileSync('dist/facility-evidence.json'));
const W={boundary:data.boundary,features:[],facilities:ctx.window.GameCore.facilities(data,proof,()=>true)};
fs.writeFileSync('dist/world-seed.json',JSON.stringify(W));console.log('World seed:',W.facilities.length);
fs.copyFileSync('game-settings.json','dist/game-settings.json');
