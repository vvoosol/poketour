import {createEngine} from '../src/shared/engine.mjs';
import {createFootRouter} from '../src/shared/routing.mjs';
import {createWorld,routePlan,fetchWorld} from '../src/shared/world.mjs';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function createWorker(resources){
 const {pokemonData:D,settings:C,seed,evidence:proof}=resources;
 const wm=createWorld(seed,proof),E=createEngine(D,C,wm.world);let footRouter=null;const localFootRouter=()=>footRouter||(footRouter=createFootRouter(resources.loadFootGraph()));
 let worldReady=false,worldPromise=null;
 async function cachedWorld(env){if(worldReady)return;const row=await env.DB.prepare('SELECT value FROM world_cache WHERE key=?').bind('osm-boundaries').first();if(row){wm.ingest(JSON.parse(row.value));worldReady=true;}}
 async function loadWorld(env){await cachedWorld(env);if(worldReady)return wm.world;if(!worldPromise)worldPromise=(async()=>{try{const raw=await fetchWorld();wm.ingest(raw);console.log(JSON.stringify({worldLoaded:true,features:wm.world.features.length,missingParks:wm.world.unresolved,status:wm.world.status}));await env.DB.prepare('INSERT INTO world_cache (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind('osm-boundaries',JSON.stringify(raw),Date.now()).run();worldReady=true;return wm.world;}catch(e){wm.world.status=e.message;return wm.world;}finally{worldPromise=null;}})();return worldPromise;}
 async function save(env,user,s,revision){
  const events=[...s.events,...(s.newEvents||[])];delete s.newEvents;s.commitToken=crypto.randomUUID();
  const update=env.DB.prepare('INSERT INTO game_saves (user_id,state,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,revision=game_saves.revision+1,updated_at=excluded.updated_at WHERE game_saves.revision=? RETURNING revision').bind(user,JSON.stringify(s),Date.now(),revision);
  const archive=env.DB.prepare("INSERT INTO game_events (user_id,event_id,event,created_at) SELECT ?,json_extract(value,'$.id'),value,json_extract(value,'$.at') FROM json_each(?) WHERE (SELECT json_extract(state,'$.commitToken') FROM game_saves WHERE user_id=?)=? ON CONFLICT(user_id,event_id) DO NOTHING").bind(user,JSON.stringify(events),user,s.commitToken);
  const result=await env.DB.batch([update,archive]);return result[0]?.results?.[0]?.revision;
 }
 return {async fetch(request,env){const url=new URL(request.url);
 if(url.pathname.startsWith('/api/')){
 const user=await env.resolveUser?.(request);if(!user)return json({error:'로컬 실행 환경을 확인하고 다시 불러와 주세요.'},401);if(!env.DB)return json({error:'진행도 저장소가 연결되지 않았습니다.'},503);
 try{await cachedWorld(env);
 if(url.pathname==='/api/events'&&request.method==='GET'){const before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(before)||before<0)return json({error:'기록 페이지 오류'},400);const result=await env.DB.prepare('SELECT event FROM game_events WHERE user_id=? AND event_id<? ORDER BY event_id DESC LIMIT 51').bind(user,before).all();const rows=result.results||[];return json({events:rows.slice(0,50).map(r=>JSON.parse(r.event)),nextBefore:rows.length>50?JSON.parse(rows[49].event).id:null});}
 if(url.pathname==='/api/world'&&request.method==='GET')return json(await loadWorld(env));
 const row=await env.DB.prepare('SELECT state,revision FROM game_saves WHERE user_id=?').bind(user).first();const revision=row?.revision||0,t=Date.now();const seedValue=[...user].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),17)>>>0;const s=E.migrate(row?JSON.parse(row.state):null,t,seedValue);
 if(url.pathname==='/api/state'&&request.method==='GET')return json({state:s,revision,serverNow:t,worldStatus:wm.world.status});
 if(request.headers.get('origin')!==url.origin)return json({error:'같은 사이트에서만 변경할 수 있습니다.'},403);
 if(request.method!=='POST')return json({error:'새 게임 버전으로 다시 불러와 주세요.'},409);
 const raw=await request.text();if(raw.length>16000)return json({error:'요청이 너무 큽니다.'},413);let input;try{input=JSON.parse(raw);}catch{return json({error:'요청 형식 오류'},400);}
 if(!Number.isInteger(input.revision)||typeof input.requestId!=='string'||input.requestId.length>100)return json({error:'요청 번호·진행도 버전 오류'},400);
 if(s.receipts?.includes(input.requestId))return json({state:s,revision,serverNow:t,replayed:true});
 if(input.revision!==revision&&input.action!=='sync')return json({error:'다른 화면에서 진행도가 변경되었습니다. 최신 상태를 불러옵니다.',state:s,revision,serverNow:t},409);
 E.advance(s,t);let plan=null;
 if(url.pathname==='/api/route'){
  if(s.pending)throw Error('이전 사건을 처리 중입니다. 잠시 후 다시 계산하세요.');if(!s.starter)throw Error('스타팅을 선택하세요.');
  const wildId=input.payload?.fieldWildId;if(wildId){if(input.payload.mode!=='walk')throw Error('야생 포켓몬은 도보로만 이동할 수 있습니다.');const w=s.fieldWilds?.find(x=>x.id===wildId&&(x.expiresAt>t||E.fieldWildProtected(s,x)));if(!w)throw Error('포켓몬이 이미 이동했습니다.');plan=await routePlan(E,s,{id:w.id,name:D.species[w.speciesId].name,coord:E.fieldPosition(w,t),fieldWildId:w.id},'walk',localFootRouter());for(const old of s.fieldWilds)if(old.pursued&&old.id!==w.id){old.pursued=false;old.moveUntil=t;}s.huntTargetId=w.id;const coord=E.fieldPosition(w,t);w.coord=coord;w.from=coord;w.to=coord;w.moveAt=t;w.moveUntil=0;w.pursued=true;}else plan=await routePlan(E,s,input.payload.id,input.payload.mode,localFootRouter());s.routePlan={...plan,token:crypto.randomUUID(),expiresAt:t+120000};
 }else if(url.pathname==='/api/action'){
  const payload=input.payload||{};
  if(input.action==='start'){if(!s.routePlan||payload.token!==s.routePlan.token||t>s.routePlan.expiresAt)throw Error('경로를 다시 계산하세요.');E.apply(s,'start',{plan:s.routePlan},t);delete s.routePlan;}
  else E.apply(s,input.action,payload,t);
 }else return json({error:'없는 API'},404);
 s.receipts=[...(s.receipts||[]),input.requestId].slice(-40);const rev=await save(env,user,s,revision);if(!rev)return json({error:'진행도 저장 충돌. 다시 불러와 주세요.'},409);return json({state:s,revision:rev,serverNow:Date.now(),plan:s.routePlan,worldStatus:wm.world.status});
 }catch(e){return json({error:e.message||'요청을 처리하지 못했습니다.'},400);}
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(!env.ASSETS)return new Response('Static assets binding is not configured',{status:503});
 return env.ASSETS.fetch(request);
 }};
}
