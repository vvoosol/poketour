'use strict';
// MapLibre owns marker positioning. All animation offsets live inside its marker.
globalThis.PoketourMapCombatView = class MapCombatView {
  constructor({animator,effects,createCanvas=()=>document.createElement('canvas'),clock=()=>Date.now()}={}){
    this.animator=animator;this.effects=effects;this.createCanvas=createCanvas;this.clock=clock;
    this.actors=new Map();this.images=new Map();this.requests=new Map();this.dead=new Map();this.feedback=new Map();
  }
  bind(key,data){
    let actor=this.actors.get(key);
    if(actor&&actor.element!==data.element){this.remove(key);actor=null;}
    if(!actor){
      const canvas=this.createCanvas(),context=canvas.getContext?.('2d');
      if(context){canvas.width=canvas.height=112;canvas.className='map-pokemon-canvas';canvas.setAttribute('aria-hidden','true');data.element.append(canvas);}
      actor={canvas:context?canvas:null,context,key};this.actors.set(key,actor);
      data.element.classList.add('map-sprite-host');
    }
    Object.assign(actor,data);return actor;
  }
  remove(key){const actor=this.actors.get(key);actor?.canvas?.remove?.();this.actors.delete(key);}
  reset(){this.dead.clear();this.feedback.clear();}
  timing(fact,move){const effect=this.effects.select(move);return fact.type==='attack'?{duration:effect.duration+220,hitAt:effect.hit}:{duration:fact.type==='faint'?450:350,hitAt:0};}
  point(actor,project,viewport){
    const rect=actor.element.getBoundingClientRect?.(),scale=viewport.rect?.width/viewport.width;
    if(rect?.width&&scale>0)return {x:(rect.x+rect.width/2-viewport.rect.x)/scale,y:(rect.y+rect.height/2-viewport.rect.y)/scale};
    const point=project(actor.coord);return {x:point.x+(actor.role==='ally'?32:0),y:point.y+(actor.role==='ally'?14:0)};
  }
  request(action){
    if(this.images.has(action.sheet)||this.requests.get(action.sheet)>this.clock())return;
    this.requests.set(action.sheet,Infinity);
    this.animator.image(action).then(image=>{this.images.set(action.sheet,image);this.requests.delete(action.sheet);},()=>this.requests.set(action.sheet,this.clock()+5000));
  }
  pose(actor,point,opponent,view,move,time){
    const fact=view?.fact,elapsed=view?.elapsed||0,duration=view?.duration||1;
    const direction=opponent?this.animator.direction(point,opponent):actor.direction||0;
    let action=actor.moving?'Walk':'Idle',animationTime=time,offset={x:0,y:0},opacity=1,flash=false;
    if(actor.model.hp>0)this.dead.delete(actor.model.uid);
    if(fact?.auto){
      if(fact.type==='attack'){
        const effect=this.effects.select(move);
        if(fact.actor===actor.model.uid){
          action=effect.contact?'Attack':'Shoot';
          const sheet=this.animator.action(actor.model.speciesId,action);
          const hitTime=sheet?sheet.ticks.slice(0,Math.min(sheet.hitFrame,sheet.frames-1)).reduce((a,b)=>a+b,0)*1000/this.animator.manifest.ticksPerSecond:0;
          const hitAt=view.hitAt||effect.hit,animationDuration=sheet?.durationMs||duration;
          animationTime=elapsed<=hitAt?elapsed/hitAt*hitTime:hitTime+(elapsed-hitAt)/(duration-hitAt)*(animationDuration-hitTime);
          if(opponent)offset=this.effects.sample(move,elapsed,point,opponent,fact.result).offset;
        }else if(fact.target===actor.model.uid&&fact.result==='hit'&&elapsed>=view.hitAt){action='Hurt';animationTime=elapsed-view.hitAt;flash=animationTime<220;}
      }else if(fact.type==='hp'&&fact.target===actor.model.uid&&fact.after<fact.before&&!view.preAnimated){action='Hurt';animationTime=elapsed;flash=elapsed<220;}
      else if(fact.type==='blocked'&&fact.actor===actor.model.uid){action='Hurt';animationTime=elapsed;}
      else if(fact.type==='faint'&&fact.target===actor.model.uid){action='Faint';animationTime=elapsed;this.dead.set(actor.model.uid,Math.min(1,elapsed/duration));}
    }
    if(flash)offset={x:offset.x+Math.sin(animationTime/22)*3,y:offset.y};
    const faded=this.dead.get(actor.model.uid)||0;opacity=1-faded;offset.y+=faded*12;
    return {action,animationTime,direction,offset,opacity,flash};
  }
  drawActor(actor,pose){
    const {model,img,canvas,context,health}=actor;
    const sample=this.animator.sample(model.speciesId,pose.action,pose.animationTime,pose.direction);
    if(sample&&context)this.request(sample.action);
    const image=sample&&this.images.get(sample.action.sheet);
    const drawn=!!(image&&context);
    img.style.opacity=drawn?'0':String(pose.opacity*(pose.flash?.55:1));
    img.style.transform=`translate(${pose.offset.x}px,${pose.offset.y}px)`;
    if(canvas){
      context.clearRect(0,0,112,112);canvas.classList.toggle('shiny-sprite',!!model.shiny);
      canvas.dataset.species=String(model.speciesId);canvas.dataset.action=pose.action;canvas.dataset.frame=String(sample?.frame??0);canvas.dataset.direction=String(pose.direction);canvas.dataset.animated=String(drawn);
      if(drawn){context.save();context.globalAlpha=pose.opacity*(pose.flash?.55:1);this.animator.draw(context,image,sample,56+pose.offset.x,74+pose.offset.y,1.5);context.restore();}
    }
    if(health)health.style.opacity=String(pose.opacity);
    actor.pose=pose;return pose;
  }
  labels(actors,viewport){
    const width=58,height=20,pad=3,occupied=[{x:0,y:viewport.height-142,w:68,h:142}];
    const overlaps=(a,b)=>a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;
    const clamp=(v,max)=>Math.max(2,Math.min(max-2,v));
    for(const actor of actors){
      const point=actor.point,health=actor.health;if(!health)continue;
      const x=point.x+actor.pose.offset.x,y=point.y+actor.pose.offset.y;
      const candidates=[{x:x-width/2,y:y-56},{x:x-width/2,y:y+30},{x:x+30,y:y-24},{x:x-width-30,y:y-24}].map(p=>({x:clamp(p.x,viewport.width-width),y:clamp(p.y,viewport.height-height),w:width,h:height}));
      const label=candidates.find(p=>!occupied.some(o=>overlaps(p,o)))||candidates[0];occupied.push(label);actor.label=label;
      Object.assign(health.style,{left:((actor.element.clientWidth||54)/2+label.x-point.x)+'px',top:((actor.element.clientHeight||54)/2+label.y-point.y)+'px',bottom:'auto',transform:'none'});
    }
    return occupied;
  }
  render({view=null,move={},project,viewport,context=null,time=this.clock()}){
    const actors=[...this.actors.values()];const byUid=new Map();
    for(const actor of actors){actor.point=this.point(actor,project,viewport);byUid.set(actor.model.uid,actor);}
    for(const actor of actors){
      const scene=view?.scene,enemy=scene&&byUid.get(actor.role==='ally'?scene.enemy?.uid:scene.ally?.uid);
      this.drawActor(actor,this.pose(actor,actor.point,actor.inBattle?enemy?.point:null,view,move,time));
    }
    const boxes=this.labels(actors,viewport),fact=view?.fact;
    if(context){
      context.clearRect(0,0,viewport.width,viewport.height);
      if(fact?.auto&&fact.type==='attack'){
        const a=byUid.get(fact.actor),b=byUid.get(fact.target);
        if(a&&b){
          this.effects.draw(context,move,view.elapsed,{x:a.point.x,y:a.point.y+2},{x:b.point.x,y:b.point.y+2},fact.result);
          if(view.elapsed>=view.hitAt){
            const damage=view.damage,text=fact.result==='miss'?'빗나감':fact.result==='immune'?'효과 없음':damage?'−'+Math.ceil(damage.before-damage.after):move.name||'기술';
            this.feedbackOnce(view.id,fact.target,text,time);
          }
          this.text(context,move.name||'공격',a,viewport,0,'#fff0b9');
        }
      }else if(fact?.auto&&fact.type==='hp'&&!view.preAnimated){
        this.feedbackOnce(view.id,fact.target,(fact.after>fact.before?'+':'−')+Math.ceil(Math.abs(fact.after-fact.before)),time);
      }
      for(const [id,item]of this.feedback){
        const elapsed=time-item.at;if(elapsed>850){this.feedback.delete(id);continue;}
        const actor=byUid.get(item.target);if(actor){context.save();context.globalAlpha=1-elapsed/850;this.text(context,item.text,actor,viewport,14+elapsed/65,'#fff6b7');context.restore();}
      }
    }
    return {actors,boxes};
  }
  feedbackOnce(id,target,text,time){if(!this.feedback.has(id))this.feedback.set(id,{target,text,at:time});}
  text(context,text,actor,viewport,lift,color){
    context.font='10px NeoDGM, monospace';context.textAlign='center';context.fillStyle=color;context.strokeStyle='#09251f';context.lineWidth=3;
    const width=context.measureText(text).width,x=Math.max(width/2+3,Math.min(viewport.width-width/2-3,actor.point.x));
    const y=Math.max(12,(actor.label?.y??actor.point.y-48)-5-lift);
    context.strokeText(text,x,y);context.fillText(text,x,y);
  }
};
