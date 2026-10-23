'use strict';
globalThis.PoketourPokemonAnimator = class PokemonAnimator {
  constructor(manifest=globalThis.PoketourCombatAssets,{baseUrl=document.baseURI,loadImage}={}) {
    this.manifest=manifest;this.baseUrl=baseUrl;this.images=new Map();
    this.loadImage=loadImage||((url)=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Sprite unavailable: '+url));image.src=url;}));
  }
  action(speciesId,name){
    const actions=this.manifest.species[speciesId]?.actions;let action=actions?.[name];const visited=new Set();
    while(action?.fallback){if(visited.has(action.fallback))return null;visited.add(action.fallback);action=actions[action.fallback];}
    return action?.sheet?action:null;
  }
  sample(speciesId,name,elapsed=0,direction=0){
    const action=this.action(speciesId,name);if(!action)return null;
    const loop=name==='Idle'||name==='Walk',ticks=action.ticks,total=ticks.reduce((a,b)=>a+b,0);
    let time=Math.max(0,elapsed)*this.manifest.ticksPerSecond/1000;
    time=loop?time%total:Math.min(time,total-Number.EPSILON*total);
    let frame=0;while(frame<ticks.length-1&&time>=ticks[frame])time-=ticks[frame++];
    const row=action.rows===1?0:((Math.round(direction)%8)+8)%8;
    return {action,frame,row,sourceX:frame*action.width,sourceY:row*action.height,
      foot:action.feet[row][frame],center:action.centers[row][frame],
      dedicated:!!this.manifest.species[speciesId]?.actions[name]?.dedicated};
  }
  image(action){
    if(!this.images.has(action.sheet)){
      const promise=this.loadImage(new URL(action.sheet,this.baseUrl).href);
      this.images.set(action.sheet,promise);promise.catch(()=>this.images.delete(action.sheet));
    }
    return this.images.get(action.sheet);
  }
  async preload(speciesId){
    const actions=this.manifest.species[speciesId]?.actions||{};
    return Promise.all([...new Set(Object.keys(actions).map(name=>this.action(speciesId,name)).filter(Boolean))].map(action=>this.image(action)));
  }
  draw(context,image,sample,x,y,scale=1){
    const {action,sourceX,sourceY,foot}=sample;context.imageSmoothingEnabled=false;
    context.drawImage(image,sourceX,sourceY,action.width,action.height,x-foot[0]*scale,y-foot[1]*scale,action.width*scale,action.height*scale);
  }
  direction(from,to){
    // Screen y grows downwards; row order is Down, DownRight, Right, ... .
    return (Math.round(Math.atan2(to.x-from.x,to.y-from.y)/(Math.PI/4))+8)%8;
  }
};
