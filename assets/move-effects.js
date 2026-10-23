'use strict';
// Selected timing/alias adaptations of Pokémon Showdown's CC0-1.0 move animation
// table, Guangcong Luo. Source commit: 0de26d2ef7258e5619057f63b3774240b45cecbd
// play.pokemonshowdown.com/src/battle-animations-moves.ts
// https://creativecommons.org/publicdomain/zero/1.0/
// Replaced BattleScene/jQuery/fx images with original Canvas2D primitives.
// This module does not import the AGPL client, images, sound, or battle rules.
globalThis.PoketourMoveEffects = (()=>{
  const definitions={
    contact:{duration:650,hit:350,color:'#ffe7a0',contact:true},
    slash:{duration:650,hit:350,color:'#fff7d1',contact:true,slash:true},
    fire:{duration:800,hit:400,color:'#ff8d37',shots:[0,100,200,300]},
    water:{duration:750,hit:400,color:'#69d7ff',shots:[0,75,150,225]},
    grass:{duration:900,hit:420,color:'#a8e35c',shots:[0,100],leaf:true},
    electric:{duration:850,hit:500,color:'#ffef6e',shots:[0],electric:true},
    energy:{duration:700,hit:400,color:'#ddacff',shots:[0]},
    status:{duration:650,hit:300,color:'#b0e9bc',status:true}
  };
  const moves={33:'contact',165:'contact',10:'slash',15:'slash',163:'slash',52:'fire',53:'fire',55:'water',346:'water',22:'grass',438:'grass',84:'electric',85:'electric',486:'electric'};
  const clamp=n=>Math.max(0,Math.min(1,n));
  function select(move={}){
    const name=moves[move.id]||(move.power<=0?'status':move.type===10?'fire':move.type===11?'water':move.type===12?'grass':move.type===13?'electric':move.class===2?'contact':'energy');
    return {...definitions[name],name,dedicated:Object.hasOwn(moves,move.id)};
  }
  function sample(move,elapsed,from,to,result='hit'){
    const effect=select(move),time=Math.max(0,elapsed),progress=clamp(time/effect.duration);
    const contact=effect.contact?Math.sin(clamp(time/effect.hit)*Math.PI/2)*(time>effect.hit?1-clamp((time-effect.hit)/(effect.duration-effect.hit)):1):0;
    const length=Math.hypot(to.x-from.x,to.y-from.y)||1,distance=Math.min(24,length*.3);
    const offset={x:(to.x-from.x)/length*distance*contact,y:(to.y-from.y)/length*distance*contact};
    const particles=(effect.shots||[]).filter(start=>time>=start&&time<=start+effect.hit).map((start,i)=>{
      const t=clamp((time-start)/effect.hit),eased=effect.name==='fire'?1-(1-t)**2:t;
      return {x:from.x+(to.x-from.x)*eased,y:from.y+(to.y-from.y)*eased+(i%2?3:-3)*Math.sin(t*Math.PI),radius:2+3*t};
    });
    return {effect,progress,offset,particles,impact:result==='hit'&&time>=effect.hit&&time<effect.hit+180,done:time>=effect.duration};
  }
  function draw(ctx,move,elapsed,from,to,result='hit'){
    const frame=sample(move,elapsed,from,to,result),effect=frame.effect;
    ctx.save();ctx.strokeStyle=ctx.fillStyle=effect.color;ctx.lineWidth=2;
    for(const p of frame.particles){
      if(effect.electric){ctx.beginPath();ctx.moveTo(p.x-6,p.y-6);ctx.lineTo(p.x+2,p.y-1);ctx.lineTo(p.x-2,p.y+2);ctx.lineTo(p.x+6,p.y+7);ctx.stroke();}
      else if(effect.leaf){ctx.fillRect(p.x-4,p.y-1,8,3);ctx.fillRect(p.x-1,p.y-3,3,7);}
      else {ctx.fillRect(p.x-p.radius,p.y-p.radius,p.radius*2,p.radius*2);}
    }
    if(frame.impact){for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(to.x+Math.cos(a)*5,to.y+Math.sin(a)*5);ctx.lineTo(to.x+Math.cos(a)*13,to.y+Math.sin(a)*13);ctx.stroke();}}
    if(effect.status){ctx.globalAlpha=1-frame.progress;ctx.strokeRect(from.x-10-frame.progress*8,from.y-10-frame.progress*8,20+frame.progress*16,20+frame.progress*16);}
    ctx.restore();return frame;
  }
  return {select,sample,draw,moves,definitions};
})();
