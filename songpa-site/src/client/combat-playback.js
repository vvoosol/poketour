'use strict';
// Shared by both views. Only reads immutable presentation facts; never calls the engine.
globalThis.PoketourCombatPlayback = class CombatPlayback {
  constructor({present,onChange=()=>{},onError=()=>{},clock=()=>Date.now(),setTimer=(fn,ms)=>globalThis.setTimeout(fn,ms),clearTimer=id=>globalThis.clearTimeout(id),maxAgeMs=10000,maxQueue=80}={}) {
    this.present=present||(()=>{});this.onChange=onChange;this.onError=onError;
    this.clock=clock;this.setTimer=setTimer;this.clearTimer=clearTimer;
    this.maxAgeMs=maxAgeMs;this.maxQueue=maxQueue;this.queue=[];this.current=null;
    this.cursor=0;this.generation=0;this.initialized=false;this.lastRevision=-1;this.lastSeen=0;
  }
  get playing(){return !!this.current||this.queue.length>0;}
  reset(state=null,revision=-1){
    this.generation++;if(this.token){this.token.aborted=true;this.token.cancel?.();}
    this.token=null;this.current=null;this.queue=[];
    this.cursor=Math.max(state?.seq||0,...(state?.events||[]).map(e=>e.id||0));
    this.initialized=!!state;this.lastRevision=revision;this.lastSeen=this.clock();this.onChange(this);
  }
  ingest(state,revision){
    if(!this.initialized){this.reset(state,revision);return;}
    if(Number.isFinite(revision)&&revision<=this.lastRevision)return;
    const now=this.clock(),events=(state.events||[]).filter(e=>e.id>this.cursor).sort((a,b)=>a.id-b.id);
    // Catch-up and tab resumes show the committed state, not an old animation backlog.
    if(state.pending||now-this.lastSeen>this.maxAgeMs){this.reset(state,revision);return;}
    this.lastSeen=now;this.lastRevision=revision??this.lastRevision;
    this.cursor=Math.max(this.cursor,state.seq||0,...events.map(e=>e.id));
    const fresh=events.filter(e=>e.combat?.version===1&&e.at>=now-this.maxAgeMs&&e.at<=now+1000);
    if(this.queue.length+fresh.length>this.maxQueue){this.reset(state,revision);return;}
    this.queue.push(...fresh.map(e=>JSON.parse(JSON.stringify(e))));
    if(!this.current&&this.queue.length)this.run();
  }
  async run(){
    const generation=this.generation;
    while(this.queue.length&&generation===this.generation){
      this.current=this.queue.shift();const token={aborted:false};this.token=token;
      this.onChange(this);
      let watchdog;
      try{
        const timeout=new Promise(resolve=>{watchdog=this.setTimer(()=>{token.aborted=true;resolve();},3500);token.cancel=resolve;});
        await Promise.race([Promise.resolve().then(()=>token.aborted?undefined:this.present(this.current,token)),timeout]);
      }catch(error){this.onError(error);}
      finally{this.clearTimer(watchdog);}
      if(generation!==this.generation)return;
      token.aborted=true;this.current=null;this.token=null;
    }
    if(generation===this.generation)this.onChange(this);
  }
};
