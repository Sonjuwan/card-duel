const $=id=>document.getElementById(id);
let data,config,preview,validated='',busy=false;
const el=(name,text)=>{const node=document.createElement(name);if(text!==undefined)node.textContent=String(text);return node;};
const message=text=>{$('message').textContent=text;};
async function request(path,body){const response=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const result=await response.json();if(!response.ok)throw new Error(result.error||'요청 실패');return result;}
const signature=()=>JSON.stringify(config);
function buttons(){ $('save').disabled=busy||!data||validated!==signature();$('validate').disabled=busy||!data; $('reload').disabled=busy; $('history-preview').disabled=busy||!data||!$('history').value; }
function changed(){validated='';$('audit-state').textContent='초안 수정됨 — 아래 표는 마지막 검사 결과입니다.';buttons();message('초안 수정됨 · XP 순서를 확인하려면 다시 검사하세요.');}
function row(parent,cells){const tr=el('tr');for(const cell of cells){const td=el('td');td.append(cell instanceof Node?cell:document.createTextNode(String(cell)));tr.append(td);}parent.append(tr);}
function rankInput(rank,key){const input=el('input');input.type='number';input.min='1';input.max='25';input.step='1';input.value=config.rankTuning[rank.rank]?.[key]??rank[key];input.setAttribute('aria-label',`${rank.name} ${key==='deckPower'?'덱 전력':'AI 지능'}`);input.addEventListener('input',()=>{const tuning=config.rankTuning[rank.rank]??{deckPower:rank.deckPower,intelligence:rank.intelligence};tuning[key]=Number(input.value);config.rankTuning[rank.rank]=tuning;changed();});return input;}
function renderRanks(){const list=$('ranks');list.replaceChildren();for(const rank of data.defaults.ranks)row(list,[rank.name,rankInput(rank,'deckPower'),rankInput(rank,'intelligence'),20+rank.rank*10,preview.ranks[rank.rank-1].minimumXp?.toLocaleString('ko-KR')??0]);const costs=config.unlockXp??data.defaultUnlockXp;$('xp-base').value=costs.base;$('xp-power').value=costs.perPower;}
function renderCards(){
  const list=$('cards');list.replaceChildren();const query=$('search').value.trim().toLowerCase(),filter=$('filter').value;
  const defaults=new Map(data.defaults.unlocks.map(c=>[c.cardId,c.power])),starter=new Set(data.defaults.starterIds),xp=new Map(preview.unlocks.map(c=>[c.cardId,c.xp]));let count=0;
  for(const card of [...data.cards].sort((a,b)=>a.name.localeCompare(b.name,'ko'))){
    const fixed=starter.has(card.id),custom=Object.hasOwn(config.cardPowerOverrides,card.id),power=fixed?1:config.cardPowerOverrides[card.id]??defaults.get(card.id);
    if(query&&!`${card.name} ${card.id} ${card.heroClass}`.toLowerCase().includes(query)||filter==='custom'&&!custom||filter==='starter'&&power!==1||filter==='locked'&&power===1)continue;
    const label=el('div',card.name);label.append(el('small',`${card.heroClass} · ${card.cost}마나 · ${card.id}`));const select=el('select');select.setAttribute('aria-label',`${card.name} 획득 단계`);
    const auto=el('option',fixed?'1 (시작 덱 고정)':`자동 (${defaults.get(card.id)})`);auto.value='';select.append(auto);
    if(!fixed)for(let i=1;i<=25;i++){const option=el('option',i);option.value=String(i);select.append(option);}
    select.value=custom&&!fixed?String(power):'';select.disabled=fixed;select.addEventListener('change',()=>{if(select.value)config.cardPowerOverrides[card.id]=Number(select.value);else delete config.cardPowerOverrides[card.id];changed();});
    row(list,[label,select,preview.starterIds.includes(card.id)?'기본 지급':(xp.get(card.id)?.toLocaleString('ko-KR')??'미확정')]);count++;
  }
  $('count').textContent=`${count}장 표시 · 전체 ${data.cards.length}장`;
}
function renderSummary(){const last=preview.unlocks.at(-1);$('summary').textContent=`기본 지급 ${preview.starterIds.length}장 · XP 획득 ${preview.unlocks.length}장 · 마지막 획득 ${last?.xp.toLocaleString('ko-KR')??0} XP`;}
function renderForecast(results){const summary=$('forecast'),ranks=$('forecast-ranks');summary.replaceChildren();ranks.replaceChildren();const at=(n)=>n===null?'5000판 내 미달':n+'판';for(const run of results)row(summary,[run.winPercent+'%',run.followQuest?'수행':'미수행',at(run.rank25At),at(run.allCardsAt),preview.ranks[run.rank-1].name]);for(const rank of preview.ranks)row(ranks,[rank.name,...results.filter(r=>r.followQuest).map(r=>at(r.milestones.find(m=>m.rank===rank.rank)?.games??null))]);}
function renderHistory(history){const select=$('history');select.replaceChildren();if(!history.length){const option=el('option','저장된 백업 없음');option.value='';select.append(option);}else for(const name of history){const option=el('option',name);option.value=name;select.append(option);}}
function renderDeckAudit(audit){
  const list=$('audit-ranks');list.replaceChildren();
  $('audit-state').textContent=`검사 기준: ${audit.seeds.length}개 시드 × 9직업 × 25랭크 = ${audit.checked}개 덱 · 인접 비교 증가 ${audit.increased} / 동일 ${audit.unchanged} / 감소 ${audit.decreased}`;
  for(const r of audit.rows){const search=r.search,counts=r.rank===1?'—':`↑ ${r.increased} / = ${r.unchanged} / ↓ ${r.decreased}`;row(list,[preview.ranks[r.rank-1].name,r.deckPower,r.minimum+'–'+r.maximum,r.mean,counts,r.intelligence,search?`탐색 깊이 ${search.depth} · 노드 설정 ${search.nodes} · 상대 응답 ${search.responses}`:'단계별 휴리스틱']);}
}
function rankWarning(growth){return growth.ranks.some((r,i)=>i>0&&(r.deckPower<=growth.ranks[i-1].deckPower||r.intelligence<=growth.ranks[i-1].intelligence))?'\n주의: 뒤 랭크의 전력 또는 지능이 동일하거나 더 낮은 설정이 있습니다. 의도한 값인지 확인하세요.':'';}
async function load(){busy=true;buttons();try{data=await request('/api/growth');config=structuredClone(data.config);preview=data.growth;validated='';$('version').textContent=`카드 버전: ${data.cardVersion} · 성장 버전: ${data.baseHash.slice(0,12)}`;renderRanks();renderCards();renderSummary();renderForecast(data.forecast);renderDeckAudit(data.deckAudit);renderHistory(data.history);message('설정을 불러왔습니다.');}catch(e){message(e.message);}finally{busy=false;buttons();}}
async function previewHistory(){if(!data||!$('history').value||signature()!==JSON.stringify(data.config)&&!confirm('저장하지 않은 초안을 이전 설정으로 바꿀까요?'))return;busy=true;buttons();try{const result=await request('/api/growth/history-preview',{baseHash:data.baseHash,cardVersion:data.cardVersion,backup:$('history').value});config=structuredClone(result.config);preview=result.growth;validated='';renderRanks();renderCards();renderSummary();renderForecast(result.forecast);renderDeckAudit(result.deckAudit);message('이전 설정을 초안으로 가져왔습니다. 검사를 다시 실행하고 저장해야 적용됩니다.');}catch(e){message(e.message);}finally{busy=false;buttons();}}
async function submit(save){
  if(save&&(validated!==signature()||!confirm('검사 완료한 설정을 저장할까요? 기존 설정은 백업되고 게임 서버를 재시작해야 적용됩니다.')))return;
  busy=true;buttons();const submitted=signature();
  try{const result=await request('/api/growth/'+(save?'save':'validate'),{baseHash:data.baseHash,cardVersion:data.cardVersion,config});preview=result.growth;renderCards();renderRanks();renderSummary();renderForecast(result.forecast);renderDeckAudit(result.deckAudit);
    if(save){data.baseHash=result.baseHash;data.config=result.config;data.history=result.history;renderHistory(data.history);validated='';$('version').textContent=`카드 버전: ${data.cardVersion} · 성장 버전: ${data.baseHash.slice(0,12)}`;message(`저장 완료 · 이전 설정 백업: ${result.backup}\n게임 서버 재시작 후 적용됩니다.`+rankWarning(preview));}
    else{validated=submitted;message('초안 검사 완료 · XP 미리보기 갱신됨.'+rankWarning(preview));}
    if(signature()!==submitted)$('audit-state').textContent='검사 이후 초안이 변경되었습니다. 아래 표는 이전 검사 결과입니다. 다시 검사하세요.';
  }catch(e){validated='';message(e.message);}finally{busy=false;buttons();}
}
$('validate').onclick=()=>submit(false);$('save').onclick=()=>submit(true);$('reload').onclick=()=>{if(!data||signature()===JSON.stringify(data.config)||confirm('저장하지 않은 초안을 버릴까요?'))load();};
$('history-preview').onclick=()=>void previewHistory();$('history').onchange=buttons;
$('reset-ranks').onclick=()=>{if(!config||busy)return;config.rankTuning={};renderRanks();changed();};$('reset-cards').onclick=()=>{if(!config||busy)return;config.cardPowerOverrides={};renderCards();changed();};$('search').oninput=()=>data&&renderCards();$('filter').onchange=()=>data&&renderCards();
for(const [id,key] of [['xp-base','base'],['xp-power','perPower']])$(id).oninput=()=>{if(!config)return;config.unlockXp={...(config.unlockXp??data.defaultUnlockXp),[key]:Number($(id).value)};changed();};
load();
