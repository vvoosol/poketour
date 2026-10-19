import csv,json,pathlib,collections,hashlib
R=pathlib.Path(__file__).parent
def rows(n):
 with open(R/'source-data'/f'{n}.csv',encoding='utf-8') as f:return list(csv.DictReader(f))
def index(n,key='id'):return {int(r[key]):r for r in rows(n)}
def names(n,key):return {int(r[key]):r['name'] for r in rows(n) if r['local_language_id']=='3'}
sp=index('pokemon_species');pk={int(r['species_id']):r for r in rows('pokemon') if r['is_default']=='1'}
sn=names('pokemon_species_names','pokemon_species_id');mn=names('move_names','move_id');an=names('ability_names','ability_id');tn=names('type_names','type_id');it=names('item_names','item_id')
stats=collections.defaultdict(dict);types=collections.defaultdict(list);abilities=collections.defaultdict(list)
for r in rows('pokemon_stats'):stats[int(r['pokemon_id'])][int(r['stat_id'])]=int(r['base_stat'])
for r in rows('pokemon_types'):types[int(r['pokemon_id'])].append(int(r['type_id']))
for r in rows('pokemon_abilities'):abilities[int(r['pokemon_id'])].append({'id':int(r['ability_id']),'hidden':r['is_hidden']=='1','slot':int(r['slot'])})
vg=index('version_groups');learn=collections.defaultdict(lambda:collections.defaultdict(list));machine=collections.defaultdict(lambda:collections.defaultdict(set))
for r in rows('pokemon_moves'):
 p,v,m,method=int(r['pokemon_id']),int(r['version_group_id']),int(r['move_id']),int(r['pokemon_move_method_id'])
 if int(vg[v]['order'])>29:continue
 if method==1:learn[p][v].append([int(r['level']),m])
 if method==4:machine[p][v].add(m)
flavor={};eng={}
for r in rows('pokemon_species_flavor_text'):
 i=int(r['species_id']);lang=r['language_id']
 if lang=='3':flavor[i]=r['flavor_text'].replace('\n',' ').replace('\f',' ')
 elif lang=='9':eng[i]=r['flavor_text'].replace('\n',' ').replace('\f',' ')
ev=collections.defaultdict(list)
for r in rows('pokemon_evolution'):
 i=int(r['evolved_species_id'])
 if i not in sp or not sp[i]['evolves_from_species_id']:continue
 ev[int(sp[i]['evolves_from_species_id'])].append({k:(int(v) if v.isdigit() else v) for k,v in r.items() if v!='' and k!='id'})
for i,v in [(749,30),(318,30),(940,25)]:
 assert any(e.get('minimum_level')==v for e in ev[i]),(i,ev[i])
habmap={1:['rock'],2:['forest'],3:['grass'],4:['rock'],5:['special'],6:['rock'],7:['special'],8:['urban'],9:['freshwater']}
habitat={};review=[];special=[]
for i,s in sp.items():
 h=int(s['habitat_id']) if s['habitat_id'] else None;basis='PokéAPI 서식지' if h else '게임용 설정: 체형·도감 설명·진화 계열 참고'
 hs=habmap.get(h,[]).copy();text=(flavor.get(i,'')+' '+eng.get(i,'')).lower()
 if not h:
  review.append(i);shape=int(s['shape_id']);hs=['grass','forest'] if shape in (8,9,13,14) else ['urban','grass']
  if shape in (3,5,10) and any(w in text for w in ['water','river','lake','물','강','호수']):hs=['freshwater']
  elif shape in (3,5,10) and any(w in text for w in ['ocean','sea','바다','해저']):hs=['special']
  elif any(w in text for w in ['mountain','cave','rocky','동굴','바위','산악']):hs=['rock']
  elif any(w in text for w in ['forest','woods','숲']):hs=['forest']
  elif any(w in text for w in ['swamp','marsh','습지','늪']):hs=['wetland']
 if i in (318,319,194,195,339,340,60,61,62,186,270,271,272,458,183,184,298,118,119,129,130):hs=['freshwater'];basis='게임용 설정: 담수 배치표'
 if i in (749,750):hs=['grass'];basis='게임용 설정: 초원 배치'
 if i in (940,941):hs=['grass','freshwater'];basis='게임용 설정: 물가 새 배치'
 if s['is_legendary']=='1' or s['is_mythical']=='1' or 984<=i<=995 or i in (1005,1006,1009,1010,1020,1021,1022,1023):special.append(i);hs=['special']
 habitat[i]={'habitats':hs,'basis':basis,'needsReview':not bool(h),'wild':not all(x in ['special','rock','wetland'] for x in hs)}
species={}
for i,s in sp.items():
 p=int(pk[i]['id']);available=learn[p];v=max(available,key=lambda v:int(vg[v]['order'])) if available else None
 lm=sorted({tuple(x) for x in available.get(v,[])})
 species[i]={'id':i,'pokemonId':p,'name':sn.get(i,s['identifier']),'en':s['identifier'],'gen':int(s['generation_id']),'types':types[p],'stats':[stats[p][k] for k in range(1,7)],'abilities':abilities[p],'captureRate':int(s['capture_rate']),'growth':int(s['growth_rate_id']),'baseExp':int(pk[i]['base_experience'] or 64),'from':int(s['evolves_from_species_id']) if s['evolves_from_species_id'] else None,'habitatOriginal':s['habitat_id'] or None,'description':flavor.get(i,eng.get(i,'')),'descriptionLanguage':'ko' if i in flavor else 'en','learn':lm,'machine':sorted(machine[p].get(v,set())),'learnVersion':vg[v]['identifier'] if v else None,'evolutions':ev[i],'image':f'./sprite-{i}.png' if (R/'dist'/f'sprite-{i}.png').exists() else f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{p}.png'}
moveMeta=index('move_meta','move_id');changes=collections.defaultdict(list)
for r in rows('move_meta_stat_changes'):changes[int(r['move_id'])].append([int(r['stat_id']),int(r['change'])])
moves={}
for i,r in index('moves').items():
 mm=moveMeta.get(i,{})
 moves[i]={'id':i,'name':mn.get(i,r['identifier']),'en':r['identifier'],'type':int(r['type_id']),'power':int(r['power'] or 0),'pp':int(r['pp'] or 5),'accuracy':int(r['accuracy'] or 100),'priority':int(r['priority']),'class':int(r['damage_class_id']),'target':int(r['target_id']),'ailment':int(mm.get('meta_ailment_id') or 0),'ailmentChance':int(mm.get('ailment_chance') or 0),'healing':int(mm.get('healing') or 0),'drain':int(mm.get('drain') or 0),'statChance':int(mm.get('stat_chance') or 0),'statChanges':changes[i]}
exp=collections.defaultdict(dict)
for r in rows('experience'):exp[int(r['growth_rate_id'])][int(r['level'])]=int(r['experience'])
counts=dict(collections.Counter(s['gen'] for s in species.values()))
report={'species':len(species),'generations':counts,'forms':len(rows('pokemon'))-len(species),'missingKorean':[i for i in species if i not in sn],'englishDescriptions':[i for i in species if i not in flavor],'habitatReview':review,'special':special,'wildSpecies':sum(h['wild'] for h in habitat.values()),'missingLearnsets':[i for i,s in species.items() if not s['learn']],'source':'https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv','collected':'2026-10-04','rules':'종별 SV DLC까지 제공된 최신 레벨·TM 습득표. 미등록 종은 직전 제공 버전. 데이터의 종족값·타입 상성, 게임용 단순화 효과 규칙.'}
report['missingCachedImages']=[i for i in species if not (R/'dist'/f'sprite-{i}.png').exists()]
data={'species':species,'moves':moves,'types':{i:{'name':tn.get(i,r['identifier']),'en':r['identifier']} for i,r in index('types').items()},'abilities':{i:an.get(i,r['identifier']) for i,r in index('abilities').items()},'efficacy':{r['damage_type_id']+':'+r['target_type_id']:int(r['damage_factor'])/100 for r in rows('type_efficacy')},'experience':exp,'items':{i:{'name':it.get(i,r['identifier']),'en':r['identifier']} for i,r in index('items').items()},'habitats':habitat,'report':report}
(R/'dist/pokemon-data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
(R/'dist/data-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if not isinstance(v,list)},ensure_ascii=False))
