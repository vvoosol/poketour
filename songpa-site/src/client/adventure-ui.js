'use strict';
let teamView=null;
const boxView={query:'',filter:'all',sort:'recent',limit:24};

function renderAdventure(){
 const el=$('adventure-content');el.replaceChildren();
 const guide=node('div',undefined,'tutorial-guide');guide.append(node('h3','송파 모험 시작하기'));
 const steps=node('ol');
 for(const text of ['스타팅을 골라 동행을 정하세요. 진행도는 이 브라우저에 자동 저장됩니다.','주변 장소에서 목적지를 고르고 경로·시간 확인 → 출발하기를 누르세요.','도착한 시설에서 활동하세요. 상점 구매와 치료도 도착 후에 이용합니다.'])steps.append(node('li',text));
 guide.append(steps,button('주변 장소 찾기',()=>showTab('nearby'),!game.starter));
 const minutes=Math.round(C.fieldWilds.spawnIntervalMs/60000),rare=Math.round(C.fieldWilds.rareSpawnIntervalMs/60000);
 guide.append(node('p',`탐색 중 가까운 야생은 ${minutes}분마다 ${Math.round(C.fieldWilds.spawnChance*100)}%, 먼 야생은 ${rare}분마다 ${Math.round(C.fieldWilds.rareSpawnChance*100)}% 확률로 출현합니다. 지도에 나타난 포켓몬을 누르면 접근·전투할 수 있어요.`),node('p','현재 테스트 이동속도는 10배입니다. 새 기기로 옮기기 전 메뉴에서 저장 파일을 내려받으세요.'));
 guide.append(node('p','공원 안과 경계 150m 이내에서는 주변 출현이 2분마다 90%로 보정됩니다. 지도에서 100m 안에 접근하면 첫 공격 기술을 주고받습니다. 자동은 체력 10배, 수동은 기본 체력이며 전환 시 남은 비율을 유지합니다.'));
 el.append(guide,node('h3','모험 목표'));
 for(const goal of E.adventure(game)){
  const card=node('section',undefined,'goal-card');card.append(node('strong',goal.title),node('p',goal.detail));
  const meter=node('progress');meter.max=goal.target;meter.value=goal.progress;meter.setAttribute('aria-label',goal.title+' 진행도');card.append(meter,node('small',`${goal.progress}/${goal.target}${goal.claimed?' · 보상 수령 완료':''}`));
  const rewards=[...(goal.reward.money?[goal.reward.money.toLocaleString()+'원']:[]),...Object.entries(goal.reward.items||{}).map(([id,n])=>`${C.shop[id].name} ${n}개`)];
  card.append(button(goal.claimed?'받은 보상':rewards.join(' · ')+' 받기',()=>action('claim-goal',{id:goal.id}),!goal.ready));el.append(card);
 }
}

function matchingBox(){
 const query=boxView.query.trim().normalize('NFC').toLocaleLowerCase('ko');
 const matches=game.box.filter(p=>{
  const species=D.species[p.speciesId];
  const text=([p.name,species.name,species.en].join(' ')).normalize('NFC').toLocaleLowerCase('ko');
  if(query&&(/^\d+$/.test(query)?p.speciesId!==Number(query):!text.includes(query)))return false;
  return boxView.filter==='shiny'?!!p.shiny:boxView.filter==='healthy'?p.hp>0:boxView.filter==='fainted'?p.hp<=0:true;
 });
 return matches.sort((a,b)=>{
  const primary=boxView.sort==='level'?b.level-a.level:boxView.sort==='dex'?a.speciesId-b.speciesId:boxView.sort==='name'?a.name.localeCompare(b.name,'ko'):(b.caughtAt||0)-(a.caughtAt||0);
  return primary||String(a.uid).localeCompare(String(b.uid));
 });
}
function renderBox(){
 if(!teamView)return;
 const found=matchingBox(),shown=found.slice(0,boxView.limit);
 teamView.summary.textContent=`보관함 · ${game.box.length}마리`;
 teamView.count.textContent=`검색 ${found.length}마리 · 표시 ${shown.length}마리`;
 teamView.list.replaceChildren();for(const p of shown)teamView.list.append(pokemonCard(p,true));
 if(!found.length)teamView.list.append(node('p',game.box.length?'조건에 맞는 포켓몬이 없습니다.':'보관함이 비어 있어요. 팀이 가득 차면 포획한 포켓몬이 이곳에 보관됩니다.'));
 teamView.more.hidden=shown.length>=found.length;
 teamView.more.disabled=busy||!ready;
}
function renderTeam(){
 const el=$('panel-team');
 if(!teamView){
  const title=node('h3'),party=node('div',undefined,'team-party'),box=node('details',undefined,'box-panel'),summary=node('summary');
  const search=node('input');search.type='search';search.placeholder='이름·영문명·도감 번호';search.setAttribute('aria-label','보관함 검색');
  const filter=node('select');filter.setAttribute('aria-label','보관함 상태');
  for(const [id,label]of [['all','전체'],['shiny','색이 다른 포켓몬'],['healthy','전투 가능'],['fainted','기절']]){const option=node('option',label);option.value=id;filter.append(option);}
  const sort=node('select');sort.setAttribute('aria-label','보관함 정렬');
  for(const [id,label]of [['recent','최근 포획순'],['level','레벨 높은순'],['dex','도감 번호순'],['name','이름순']]){const option=node('option',label);option.value=id;sort.append(option);}
  search.value=boxView.query;filter.value=boxView.filter;sort.value=boxView.sort;
  const controls=node('div',undefined,'box-controls'),count=node('p',undefined,'panel-subtitle'),list=node('div'),more=button('24마리 더 보기',()=>{boxView.limit+=24;renderBox();});
  controls.append(search,filter,sort);box.append(summary,controls,count,list,more);
  search.oninput=()=>{boxView.query=search.value;boxView.limit=24;renderBox();};
  filter.onchange=()=>{boxView.filter=filter.value;boxView.limit=24;renderBox();};
  sort.onchange=()=>{boxView.sort=sort.value;boxView.limit=24;renderBox();};
  el.replaceChildren(title,node('p','동행을 선택하면 캐릭터 옆에서 함께 걸어요.','panel-subtitle'),party,box);
  teamView={title,party,box,summary,search,filter,sort,count,list,more};
 }
 teamView.title.textContent=`탐험 팀 ${game.player.party.length}/6`;
 teamView.party.replaceChildren();for(const p of game.player.party)teamView.party.append(pokemonCard(p));
 renderBox();
}
