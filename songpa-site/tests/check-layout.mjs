import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { projectPath } from '../scripts/paths.mjs';

const canvas = { dataset: { layout: 'portrait' }, style: { setProperty(name,value) { this[name]=value; } } };
const stage = { clientWidth:360, clientHeight:800, querySelector:()=>canvas };
let resize, coarse=false;
const events=[];
const window = { screen:{orientation:{type:'portrait-primary',addEventListener(){}}}, matchMedia:()=>({matches:coarse}), dispatchEvent:event=>events.push(event.type) };
vm.runInNewContext(fs.readFileSync(projectPath('dist/client/layout.js'),'utf8'), {
  window, document:{getElementById:()=>stage}, ResizeObserver:class{constructor(fn){resize=fn;}observe(){}}, CustomEvent:class{constructor(type){this.type=type;}},
});
for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[568,320],[800,360],[844,390],[1366,768],[1920,1080]]) {
  stage.clientWidth=width;stage.clientHeight=height;resize();
  const {mode,width:w,height:h,scale}=window.PoketourLayout.measure(width,height);
  assert.equal(canvas.dataset.layout,mode);
  assert.equal(w/h,mode==='portrait'?9/20:20/9);
  assert(w*scale<=width+.001&&h*scale<=height+.001,'Entire fixed canvas fits without clipping');
  assert.equal(Number(canvas.style['--game-scale']),scale);
}
coarse=true;stage.clientWidth=390;stage.clientHeight=280;resize();
assert.equal(canvas.dataset.layout,'portrait','Phone keyboard cannot switch the physical orientation');
window.screen.orientation.type='landscape-primary';resize();assert.equal(canvas.dataset.layout,'landscape');
assert(events.includes('poketour:layout'),'Map gets notified when logical dimensions change');
for(const name of ['style.css','mobile.css','ui-theme.css','layout.css']) {
  const css=fs.readFileSync(projectPath('dist/client',name),'utf8');
  assert(!/@media[^{}]*(?:max|min)-width/.test(css),'No viewport width breakpoints: '+name);
  assert(!css.includes('cqw'),'No viewport-dependent internal metrics: '+name);
}
console.log('PASS fixed layout: ten viewport sizes fit two phone ratios, stable logical dimensions, physical keyboard orientation and map resize notification (not browser rendering)');
