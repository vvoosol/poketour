import fs from 'node:fs';import vm from 'node:vm';
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/client/game-config.js','utf8'),ctx);vm.runInContext(fs.readFileSync('src/client/game-core.js','utf8'),ctx);
const data=JSON.parse(fs.readFileSync('public/songpa-osm.json')),proof=JSON.parse(fs.readFileSync('public/facility-evidence.json'));
const W={boundary:data.boundary,features:[],facilities:ctx.window.GameCore.facilities(data,proof,()=>true)};
fs.writeFileSync('dist/client/world-seed.json',JSON.stringify(W));console.log('World seed:',W.facilities.length);
fs.copyFileSync('game-settings.json','dist/client/game-settings.json');
