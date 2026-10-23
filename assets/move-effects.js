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
  // Shared, presentation-only capture timeline; the engine already decided
  // success. No random roll or inventory change belongs in an animation.
  function captureSample(elapsed,from,to,success){
    const t=Math.max(0,elapsed),flight=clamp(t/600),result=t>=1750;
    return {x:from.x+(to.x-from.x)*flight+(t>=850&&!result?Math.sin((t-850)/65)*4:0),
      y:from.y+(to.y-from.y)*flight-Math.sin(flight*Math.PI)*50,
      enemyOpacity:t<600?1:t<850?1-clamp((t-600)/250):result&&!success?clamp((t-1750)/200):0,
      phase:t<600?'throw':t<850?'absorb':!result?'shake':success?'caught':'escaped',
      result,success,done:t>=2600};
  }
  function drawCapture(ctx,elapsed,from,to,success,ball='poke-ball'){
    const f=captureSample(elapsed,from,to,success),x=Math.round(f.x),y=Math.round(f.y);
    ctx.save();ctx.fillStyle='#132b26';ctx.fillRect(x-8,y-8,16,16);
    ctx.fillStyle=ball==='great-ball'?'#4985ed':ball==='ultra-ball'?'#e6c74b':'#ed6152';ctx.fillRect(x-6,y-6,12,6);
    ctx.fillStyle='#fff5d7';ctx.fillRect(x-6,y+1,12,5);ctx.fillRect(x-2,y-2,4,4);
    if(f.phase==='caught'){ctx.fillStyle='#d8ff6c';for(const dx of [-15,0,15]){ctx.fillRect(x+dx-1,y-21,3,9);ctx.fillRect(x+dx-4,y-18,9,3);}}
    if(f.phase==='escaped'){ctx.strokeStyle='#fff5d7';ctx.lineWidth=2;ctx.strokeRect(x-14,y-14,28,28);}
    ctx.restore();return f;
  }
  return {select,sample,draw,captureSample,drawCapture,moves,definitions};
})();
