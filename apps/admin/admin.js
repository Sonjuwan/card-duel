const el=id=>document.getElementById(id);
let mechanicsByKind={};
const mechanicKeys=()=>mechanicsByKind[cards[index]?.kind]??[];
const classes={neutral:'공용',warrior:'전사',shaman:'주술사',rogue:'도적',paladin:'성기사',hunter:'사냥꾼',druid:'드루이드',warlock:'흑마법사',mage:'마법사',priest:'사제'};
const kinds={minion:'하수인',spell:'주문',weapon:'무기',secret:'비밀'};
const rarities={basic:'기본',common:'일반',rare:'희귀',epic:'영웅',legendary:'전설'};
const tribes={none:'없음',beast:'야수',demon:'악마',dragon:'용족',murloc:'멀록',pirate:'해적',totem:'토템'};
const keywords={taunt:'도발',charge:'돌진',divineShield:'천상의 보호막',windfury:'질풍',stealth:'은신',poisonous:'독성'};
const zones={battlecry:'전투의 함성/장착 직후',deathrattle:'죽음의 메아리',startTurn:'내 턴 시작',endTurn:'내 턴 종료',endAnyTurn:'모든 턴 종료',effects:'주문/비밀 일반 효과',beforeAttack:'무기 공격 직전',friendlySummon:'아군 소환 시',secretRevealed:'비밀 공개 시'};
const numberNames={amount:'수치',amountMax:'최대 수치',attack:'공격력',health:'생명력',durability:'내구도',count:'횟수',factor:'배수',spellDamage:'주문 공격력',minimum:'최소 비용',discount:'비용 할인',splash:'범위 피해',bonusIfCombo:'연계 추가 피해',enrageAttack:'격노 공격력',enrageWeaponAttack:'격노 무기 공격력'};
let version='',cards=[],original=[],index=0,formDirty=false,busy=false;
let analysis=null,labStatus=null,labTimer=null;
function message(text,ok=true){el('message').textContent=text;el('message').style.color=ok?'#85eab6':'#ff9ea8';}
function option(value,label){const o=document.createElement('option');o.value=value;o.textContent=label;return o;}
function cardLabel(c){return c.cost+' · '+c.name+' ('+(kinds[c.kind]??c.kind)+')';}
function changed(i){return JSON.stringify(cards[i])!==JSON.stringify(original[i]);}
function status(){const edited=cards.map((c,i)=>({c,i})).filter(({i})=>changed(i));el('changes').textContent='반영된 변경 카드 '+edited.length+'종'+(formDirty?' · 편집 중':'');el('reset').disabled=busy||!cards.length||(!changed(index)&&!formDirty);el('draft-diff').hidden=!edited.length;el('draft-diff-list').replaceChildren(...edited.map(({c,i})=>{const p=document.createElement('p'),before=original[i];if(!before)p.textContent=c.id+' · 새 카드';else{const fields=Array.from(new Set([...Object.keys(before),...Object.keys(c)])).filter(k=>JSON.stringify(before[k])!==JSON.stringify(c[k]));p.textContent=c.id+' · '+fields.map(k=>[k,['number','string'].includes(typeof c[k])&&['number','string'].includes(typeof before[k])?String(before[k])+' → '+String(c[k]):'변경'].join(': ')).join(', ');}return p;}));}
function mechanicObject(){const value=JSON.parse(el('effects').value);if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!mechanicKeys().includes(k)))throw new Error('이 카드 종류에 허용되지 않는 효과 설정 필드입니다.');return value;}
function showEffectNumbers(){
  const root=el('effect-numbers');root.replaceChildren();
  let object;try{object=mechanicObject();}catch{root.textContent='JSON 형식을 고친 뒤 간편 수치 편집을 사용할 수 있습니다.';return;}
  function walk(value,path){
    if(typeof value==='number'){
      const label=document.createElement('label'),input=document.createElement('input');
      const tail=String(path.at(-1)),parent=path.slice(0,-1).reduce((v,k)=>v[k],object);
      label.textContent=path.map(k=>typeof k==='number'?k+1:k).join(' / ')+(parent?.kind?' · '+parent.kind:'')+' · '+(numberNames[tail]??tail);
      input.type='number';input.step='1';input.value=String(value);
      input.addEventListener('input',()=>{formDirty=true;status();if(input.value.trim()===''||!Number.isInteger(Number(input.value))){input.setCustomValidity('효과 수치는 정수로 입력하세요.');message('효과 수치는 정수로 입력하세요.',false);return;}input.setCustomValidity('');try{
        const latest=mechanicObject(),dest=path.slice(0,-1).reduce((v,k)=>v[k],latest);dest[path.at(-1)]=Number(input.value);el('effects').value=JSON.stringify(latest,null,2);formDirty=true;status();
      }catch(err){message(err.message,false);}});label.append(input);root.append(label);return;
    }
    if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))walk(item,[...path,Array.isArray(value)?Number(key):key]);
  }
  walk(object,[]);if(!root.children.length)root.textContent='조정 가능한 숫자 효과가 없습니다. 고급 JSON에서 효과를 수정할 수 있습니다.';syncMechanics(object);
}
function syncMechanics(object){
  for(const input of el('keyword-fields').querySelectorAll('input'))input.checked=Array.isArray(object.keywords)&&object.keywords.includes(input.value);
  const old=el('effect-zone').value,allowed=mechanicKeys().filter(k=>Object.hasOwn(zones,k)&&(!object.choices||!['effects','battlecry'].includes(k)));el('effect-zone').replaceChildren(...allowed.map(k=>option(k,zones[k])));if(allowed.includes(old))el('effect-zone').value=old;el('quick-effects').hidden=!allowed.length;renderEffectList(object);
}
function renderEffectList(object){const key=el('effect-zone').value,list=Array.isArray(object[key])?object[key]:[];el('effect-list').replaceChildren(...list.map((effect,i)=>{const row=document.createElement('div'),label=document.createElement('p'),remove=document.createElement('button');row.className='grid';label.textContent=(i+1)+'. '+effect.kind+' · '+JSON.stringify(effect);label.style.overflowWrap='anywhere';remove.className='secondary';remove.textContent='제거';remove.disabled=busy;remove.onclick=()=>{try{const latest=mechanicObject();latest[key].splice(i,1);if(!latest[key].length)delete latest[key];changeMechanics(latest);}catch(err){message(err.message,false);}};row.append(label,remove);return row;}));}
function changeMechanics(object){el('effects').value=JSON.stringify(object,null,2);formDirty=true;showEffectNumbers();status();}
function show(){
  const c=cards[index];if(!c)return;
  el('cards').value=String(index);el('meta').textContent=[c.id,kinds[c.kind],classes[c.class],rarities[c.rarity],c.collectible===false?'토큰':''].filter(Boolean).join(' · ');
  for(const key of ['name','cost','attack','health','durability','description']){const field=el(key);field.disabled=c[key]===undefined;field.value=c[key]??'';}
  el('minion-fields').hidden=c.kind!=='minion';el('tribe').value=c.tribe??'none';el('cost').max=c.kind==='minion'&&c.discountBy?30:10;
  el('effects').value=JSON.stringify(Object.fromEntries(mechanicKeys().filter(k=>c[k]!==undefined).map(k=>[k,c[k]])),null,2);formDirty=false;showEffectNumbers();status();
  el('new-class').value=c.class;el('new-rarity').value=c.rarity;el('new-collectible').value=c.collectible===false?'token':'deck';el('reset').textContent=original[index]?'현재 카드 수정 취소':'새 카드 초안 제거';
}
function readNumber(key,min,max){const value=el(key).value;if(value.trim()===''||!Number.isInteger(Number(value))||Number(value)<min||Number(value)>max)throw new Error(key+' 수치는 '+min+'~'+max+'의 정수여야 합니다.');return Number(value);}
function apply(){
  const c=cards[index];if(!c||!formDirty)return;
  if([...el('effect-numbers').querySelectorAll('input')].some(input=>!input.validity.valid))throw new Error('간편 효과 수치에 올바른 정수를 입력하세요.');
  const next={...c,name:el('name').value.trim(),cost:readNumber('cost',0,30),description:el('description').value};if(c.kind==='minion')next.tribe=el('tribe').value;
  if(!next.name)throw new Error('카드 이름을 입력하세요.');
  for(const k of ['attack','health','durability'])if(!el(k).disabled)next[k]=readNumber(k,k==='attack'?0:1,100);
  // preserve field order for reliable diff; delete only mechanics removed by user
  const mechanics=mechanicObject();for(const k of mechanicKeys()){if(Object.hasOwn(mechanics,k))next[k]=mechanics[k];else delete next[k];}cards[index]=next;
  const selected=Array.from(el('cards').options).find(o=>o.value===String(index));if(selected)selected.textContent=cardLabel(next);
  formDirty=false;status();return next;
}
function visibleCards(){
  const q=el('search').value.trim().toLowerCase(),klass=el('class-filter').value,kind=el('kind-filter').value,rarity=el('rarity-filter').value,token=el('token-filter').value;
  return cards.map((c,i)=>({c,i})).filter(({c})=>(klass==='all'||c.class===klass)&&(kind==='all'||c.kind===kind)&&(rarity==='all'||c.rarity===rarity)&&(token==='all'||(token==='tokens'?c.collectible===false:c.collectible!==false))&&(!q||[c.id,c.name,c.description].some(x=>x.toLowerCase().includes(q)))).sort((a,b)=>a.c.cost-b.c.cost||a.c.name.localeCompare(b.c.name,'ko'));
}
function list(){
  const visible=visibleCards();el('cards').replaceChildren(...visible.map(({c,i})=>option(String(i),cardLabel(c))));el('count').textContent=visible.length+'/'+cards.length+'종';
  el('editor').hidden=!visible.length;if(!visible.length)return;
  if(!visible.some(x=>x.i===index))index=visible[0].i;show();
}
async function request(path,payload){const response=await fetch(path,payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{});const data=await response.json();if(!response.ok)throw new Error(data.error??'요청 실패');return data;}
async function load(){
  const d=await request('/api/cards');version=d.version;cards=d.cards;mechanicsByKind=d.mechanics;original=structuredClone(cards);formDirty=false;el('version').textContent=version;el('versions').replaceChildren(...d.versions.map(v=>option(v,v)));el('versions').value=version;el('version-diff').hidden=true;index=Math.max(0,Math.min(index,cards.length-1));list();status();
}
function setBusy(value){busy=value;for(const id of ['save','validate','restore','compare','apply','cards','search','class-filter','kind-filter','rarity-filter','token-filter','versions','clone','new-id','new-class','new-rarity','new-collectible','analyze','tribe','effect-zone','effect-preset','effect-amount','effect-add'])el(id).disabled=value;el('lab-start').disabled=value||labStatus?.state==='running';const card=cards[index];for(const key of ['name','cost','attack','health','durability','description'])el(key).disabled=value||!card||card[key]===undefined;el('effects').disabled=value;for(const input of document.querySelectorAll('#effect-numbers input,#keyword-fields input,#effect-list button'))input.disabled=value;status();}
function tryApply(){if(!el('editor').hidden)apply();}
for(const id of ['name','cost','attack','health','durability','description','effects'])el(id).addEventListener('input',()=>{formDirty=true;status();});
el('effects').addEventListener('change',showEffectNumbers);
el('tribe').replaceChildren(...Object.entries(tribes).map(([v,n])=>option(v,n)));el('tribe').onchange=()=>{formDirty=true;status();};
for(const [value,name] of Object.entries(keywords)){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=value;input.style.width='auto';input.onchange=()=>{try{const object=mechanicObject(),set=new Set(object.keywords??[]);if(input.checked)set.add(value);else set.delete(value);if(set.size)object.keywords=[...set];else delete object.keywords;changeMechanics(object);}catch(err){message(err.message,false);}};label.append(input,document.createTextNode(' '+name));el('keyword-fields').append(label);}
el('effect-zone').onchange=()=>{try{renderEffectList(mechanicObject());}catch(err){message(err.message,false);}};
el('effect-add').onclick=()=>{try{const object=mechanicObject(),key=el('effect-zone').value,amount=readNumber('effect-amount',1,20),preset=el('effect-preset').value;if(!mechanicKeys().includes(key)||!Object.hasOwn(zones,key))throw new Error('올바른 발동 시점을 선택하세요.');const effect=preset==='damage'?{kind:'damage',target:'enemyHero',amount}:preset==='areaDamage'?{kind:'damage',target:'enemyMinions',amount}:preset==='heal'?{kind:'heal',target:'friendlyHero',amount}:preset==='buff'?{kind:'buff',target:'friendlyMinions',attack:amount,health:amount}:{kind:preset,amount};if(object[key]&&!Array.isArray(object[key]))throw new Error('고급 JSON을 먼저 수정하세요.');object[key]=[...(object[key]??[]),effect];changeMechanics(object);message('효과 초안을 추가했습니다. 설명을 맞추고 저장 전 검사를 실행하세요.');}catch(err){message(err.message,false);}};
for(const id of ['search','class-filter','kind-filter','rarity-filter','token-filter'])el(id).addEventListener(id==='search'?'input':'change',()=>{try{tryApply();list();}catch(err){message(err.message,false);}});
el('cards').addEventListener('change',e=>{const next=Number(e.target.value);try{apply();index=next;show();}catch(err){message(err.message,false);el('cards').value=String(index);}});
el('apply').addEventListener('click',()=>{try{apply();message('메모리에 반영했습니다. 새 버전 저장을 눌러 파일에 보존하세요.');}catch(err){message(err.message,false);}});
el('reset').addEventListener('click',()=>{if(!original[index]){if(!window.confirm('저장하지 않은 새 카드 초안을 제거할까요?'))return;cards.splice(index,1);index=Math.max(0,index-1);list();message('새 카드 초안을 제거했습니다.');return;}if(!window.confirm('이 카드의 수정 사항을 마지막 저장 상태로 되돌릴까요?'))return;cards[index]=structuredClone(original[index]);list();message('현재 카드를 마지막 저장 상태로 되돌렸습니다.');});
el('clone').addEventListener('click',()=>{try{
  const id=el('new-id').value.trim();if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id))throw new Error('새 ID는 영문 소문자 또는 숫자로 시작하고, 소문자·숫자·밑줄·하이픈 1~64자로 입력하세요.');
  if(cards.some(c=>c.id===id))throw new Error('이미 사용 중인 카드 ID입니다.');
  apply();const next={...structuredClone(cards[index]),id,name:'새 '+cards[index].name,class:el('new-class').value,rarity:el('new-rarity').value,collectible:el('new-collectible').value==='deck'};
  cards.push(next);index=cards.length-1;el('new-id').value='';for(const key of ['class-filter','kind-filter','rarity-filter','token-filter'])el(key).value='all';el('search').value=id;list();el('name').focus();message('새 카드 초안을 추가했습니다. 이름/수치/효과를 수정하고 저장 전 검사를 실행하세요.');
}catch(err){message(err.message,false);}});
el('validate').addEventListener('click',async()=>{try{tryApply();setBusy(true);const result=await request('/api/validate',{baseVersion:version,cards});message('검사 통과: '+result.collectible+'종 덱 카드, 전체 '+result.total+'개 정의 · 랭크 AI 덱 '+result.rankedDecks+'개 검사. 아직 저장하지 않았습니다.');}catch(err){message(err.message,false);}finally{setBusy(false);}});
el('save').addEventListener('click',async()=>{try{tryApply();setBusy(true);const saved=await request('/api/save',{baseVersion:version,cards});await load();message('저장 완료: '+saved.version+'\n이전 버전은 그대로 보존되었습니다.');}catch(err){message(err.message,false);}finally{setBusy(false);}});
el('restore').addEventListener('click',async()=>{try{const selected=el('versions').value;if(!window.confirm(selected+'을 활성화하시겠습니까? 저장하지 않은 변경은 취소됩니다.'))return;setBusy(true);await request('/api/activate',{baseVersion:version,version:selected});await load();message('이전 버전이 활성화되었습니다.');}catch(err){message(err.message,false);}finally{setBusy(false);}});
el('compare').addEventListener('click',async()=>{try{setBusy(true);const data=await request('/api/compare',{from:el('versions').value,to:version});const root=el('version-diff-list');root.replaceChildren();const add=text=>{const p=document.createElement('p');p.textContent=text;root.append(p);};for(const c of data.added)add('+ '+c.name+' ('+c.id+')');for(const c of data.removed)add('− '+c.name+' ('+c.id+')');for(const c of data.changed){add(c.name+' ('+c.id+')');for(const f of c.fields){const d=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=f.field;pre.textContent=JSON.stringify(f.before,null,2)+'\n  →\n'+JSON.stringify(f.after,null,2);pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';d.append(summary,pre);root.append(d);}}el('version-diff-summary').textContent=data.from+' → '+data.to+' · 추가 '+data.added.length+' / 제거 '+data.removed.length+' / 변경 '+data.changed.length;el('version-diff').hidden=false;el('version-diff').open=true;message('버전 비교 완료. 활성 버전은 바뀌지 않았습니다.');}catch(err){message(err.message,false);}finally{setBusy(false);}});
function tableRow(values){const row=document.createElement('tr');for(const value of values){const td=document.createElement('td');td.textContent=String(value);td.style.padding='7px 4px';td.style.borderBottom='1px solid #42516a';row.append(td);}return row;}
function renderAnalysis(){if(!analysis)return;const cls=el('analysis-class').value,filter=el('analysis-filter').value;
  const rows=analysis.rows.filter(r=>(cls==='all'||cls===r.class)&&(filter==='all'||filter==='changed'&&r.changed||filter===r.flag)).sort((a,b)=>a.cost-b.cost||b.delta-a.delta);
  const flags={high:'높음',low:'낮음',typical:'중간',fewPeers:'표본 부족'};
  el('analysis-rows').replaceChildren(...rows.map(r=>tableRow([r.name+(r.changed?' ★':''),r.oldCost!==null&&r.oldCost!==r.cost?r.oldCost+' → '+r.cost:r.cost,r.oldScore!==null&&r.oldScore!==r.score?r.oldScore+' → '+r.score:r.score,r.peerMedian+' ('+r.peerCount+'종)',(r.delta>0?'+':'')+r.delta,flags[r.flag]])));
  const selection=analysis.classes.filter(c=>cls==='all'||c.class===cls),curve=Array.from({length:12},(_,i)=>selection.reduce((sum,c)=>sum+c.curve[i],0)),max=Math.max(1,...curve),bars=document.createElement('div');bars.style.cssText='display:flex;align-items:flex-end;gap:4px;height:120px';
  for(const [i,count] of curve.entries()){const box=document.createElement('div'),bar=document.createElement('div'),label=document.createElement('div');box.style.cssText='flex:1;text-align:center;font-size:12px';bar.style.cssText='height:'+Math.max(2,count/max*85)+'px;background:#b4c79d;border-radius:4px 4px 0 0';label.textContent=i===11?'11+':String(i);box.append(document.createTextNode(String(count)),bar,label);bars.append(box);}el('analysis-curve').replaceChildren(bars);el('analysis-count').textContent='카드 '+rows.length+'종 · 분석 당시 초안 기준';el('analysis-results').hidden=false;
}
el('analysis-class').replaceChildren(option('all','전체'),...Object.entries(classes).map(([v,n])=>option(v,n)));
for(const id of ['analysis-class','analysis-filter'])el(id).addEventListener('change',renderAnalysis);
el('analyze').addEventListener('click',async()=>{try{tryApply();setBusy(true);analysis=await request('/api/analysis',{baseVersion:version,cards});renderAnalysis();message('카드 수치 분석 완료. 저장하지 않았습니다.');}catch(err){message(err.message,false);}finally{setBusy(false);}});
const rate=(wins,total)=>total?Math.round(100*wins/total)+'%':'—';
function renderLab(){const s=labStatus,active=s?.state==='running';el('lab-start').disabled=busy||active;el('lab-cancel').disabled=!active;if(!s)return;
  el('lab-progress').max=s.config.pairs;el('lab-progress').value=s.result?.completedPairs??0;
  const names={running:'시험 중',complete:'시험 완료',cancelled:'시험 중단',error:'시험 오류'};el('lab-status').textContent=names[s.state]+' · 원본 '+s.version+' · '+(s.result?.completedPairs??0)+'/'+s.config.pairs+' 묶음'+(s.config.focus?' · '+s.config.focus+(s.config.newFocus?' (기존 카드 1장 교체)':' 집중'):'')+(s.error?' · '+s.error:'');
  const r=s.result;el('lab-results').hidden=!r;if(!r)return;
  const old=r.original,fresh=r.draft,valid=r.pilotGains+r.pilotLosses+r.pilotTies;
  el('lab-summary').textContent='완료 경기 '+(old.finished+fresh.finished)+' · 제한 초과 '+(old.truncated+fresh.truncated)+' · 결과 변경 '+r.changedOutcomes+'경기 · 실험 덱 승점률 '+rate(r.pilotOriginalPoints,valid*2)+' → '+rate(r.pilotDraftPoints,valid*2)+' (유효 '+valid+'묶음, 개선 '+r.pilotGains+'/악화 '+r.pilotLosses+'/동일 '+r.pilotTies+') · 총 행동 '+(old.moves+fresh.moves);
  const classTable=document.createElement('table');classTable.style.cssText='width:100%;text-align:left';classTable.append(tableRow(['직업','원본 승률·표본','초안 승률·표본']));for(const [id,n] of Object.entries(classes)){if(id==='neutral')continue;const a=old.classes[id],b=fresh.classes[id];if(a.games||b.games)classTable.append(tableRow([n,rate(a.wins,a.games)+' ('+a.games+')',rate(b.wins,b.games)+' ('+b.games+')']));}el('lab-classes').replaceChildren(classTable);
  const ids=[...new Set([...Object.keys(old.cards),...Object.keys(fresh.cards),...s.changedIds])].filter(id=>el('lab-card-filter').value==='all'||s.changedIds.includes(id)).sort((a,b)=>(fresh.cards[b]?.playedGames??0)-(fresh.cards[a]?.playedGames??0));
  el('lab-card-rows').replaceChildren(...ids.map(id=>{const a=old.cards[id],b=fresh.cards[id],label=cards.find(c=>c.id===id)?.name??id;return tableRow([label,(a?.deckGames??0)+' → '+(b?.deckGames??0),(a?.handGames??0)+' → '+(b?.handGames??0),(a?.playedGames??0)+' → '+(b?.playedGames??0),rate(a?.playedWins??0,a?.playedGames??0)+' → '+rate(b?.playedWins??0,b?.playedGames??0)]);}));
}
async function pollLab(){clearTimeout(labTimer);try{labStatus=await request('/api/lab/status');renderLab();}catch(err){el('lab-status').textContent=err.message;}if(labStatus?.state==='running')labTimer=setTimeout(pollLab,1000);}
el('lab-start').addEventListener('click',async()=>{try{tryApply();setBusy(true);const focus=el('lab-focus').checked?cards[index]?.id:undefined;labStatus=await request('/api/lab/start',{baseVersion:version,cards,pairs:Number(el('lab-pairs').value),seed:Number(el('lab-seed').value),level:Number(el('lab-level').value),focus});renderLab();void pollLab();}catch(err){el('lab-status').textContent=err.message;}finally{setBusy(false);}});
el('lab-cancel').addEventListener('click',async()=>{try{labStatus=await request('/api/lab/cancel',{id:labStatus?.id});renderLab();}catch(err){el('lab-status').textContent=err.message;}});
el('lab-card-filter').addEventListener('change',renderLab);
window.addEventListener('beforeunload',e=>{if(formDirty||cards.some((_,i)=>changed(i))){e.preventDefault();e.returnValue='';}});
for(const [id,values] of [['class-filter',classes],['kind-filter',kinds],['rarity-filter',rarities]])el(id).replaceChildren(option('all','전체'),...Object.entries(values).map(([value,label])=>option(value,label)));
for(const [id,values] of [['new-class',classes],['new-rarity',rarities]])el(id).replaceChildren(...Object.entries(values).map(([value,label])=>option(value,label)));
load().then(pollLab).catch(err=>message(err.message,false));
