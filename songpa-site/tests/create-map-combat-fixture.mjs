// An isolated browser QA backup. Does not open or modify any user's database.
import fs from 'node:fs';
import {createEngine} from '../src/shared/engine.mjs';
const read=n=>JSON.parse(fs.readFileSync('dist/client/'+n));
const E=createEngine(read('pokemon-data.json'),read('game-settings.json'),read('world-seed.json'));
const t=Date.now(),s=E.migrate(null,t,42);
E.apply(s,'demo',{},t);E.apply(s,'starter',{id:749},t);E.apply(s,'settings',{auto:false},t);
const coord=[s.game.coord[0]+.00055,s.game.coord[1]];
s.fieldWilds=[{id:'qa-map-wild',speciesId:915,level:5,habitat:'urban',place:'지도 모션 검증',coord,expiresAt:t+3600000,pursued:true}];
E.apply(s,'pursue-wild',{id:'qa-map-wild'},t);s.battle.enemy.hp=3;
delete s.newEvents;
const destination='../docs/qa/map-combat-fixture.json';fs.mkdirSync('../docs/qa',{recursive:true});
fs.writeFileSync(destination,JSON.stringify({format:'poketour-backup-v1',exportedAt:t,state:s,events:s.events},null,2));
console.log('Created QA-only manual battle. Import on a new temporary origin, then enable auto to exercise 10x HP and map animations. '+destination);
