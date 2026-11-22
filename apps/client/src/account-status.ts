import type {AccountActiveRoom,AccountView,AccountExport,DeveloperRuntimeStatus,DeveloperStatus,GrowthView} from '../../../packages/account-protocol.ts';
import {HERO_CLASSES} from '../../../packages/engine/src/index.ts';
import {QUEST_LENGTH,WINS_PER_RANK} from '../../../packages/progression.ts';
import {decodeAccountProfile} from '../../../packages/account-profile.ts';
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
/** A successful HTTP status alone must not replace a usable profile with a
 * malformed proxy or server response. Historical card IDs remain valid data. */
export function decodeAccountView(input:unknown):AccountView{
  const invalid=()=>{throw Error('계정 정보 응답 형식 오류 · 연결을 다시 확인하세요.');};
  if(!record(input)||typeof input.id!=='string'||!input.id||typeof input.email!=='string'||typeof input.role!=='string'||!['player','developer'].includes(input.role)||!record(input.profile))return invalid();
  try{return {...input,profile:decodeAccountProfile(input.profile)} as unknown as AccountView;}catch{return invalid();}
}
export function decodeAccountExport(input:unknown):AccountExport{
  const invalid=()=>{throw Error('성장 기록 응답 형식 오류 · 다시 확인하세요.');};
  if(!record(input)||Object.keys(input).length!==4||input.schemaVersion!==1||typeof input.gameVersion!=='string'||!input.gameVersion||typeof input.exportedAt!=='string'||!Number.isFinite(Date.parse(input.exportedAt)))return invalid();
  try{return {schemaVersion:1,gameVersion:input.gameVersion,exportedAt:input.exportedAt,profile:decodeAccountProfile(input.profile)};}catch{return invalid();}
}
export function decodeGrowthView(input:unknown):GrowthView{
  const invalid=()=>{throw Error('성장 정보 응답 형식 오류 · 다시 확인하세요.');};
  if(!record(input)||!Array.isArray(input.ranks)||input.ranks.length!==25||!Array.isArray(input.starterIds)||!Array.isArray(input.unlocks)||!Array.isArray(input.questOrder)||input.questOrder.length!==HERO_CLASSES.length||input.questOrder.some((hero,i)=>hero!==HERO_CLASSES[i])||input.questLength!==QUEST_LENGTH||input.winsPerRank!==WINS_PER_RANK)return invalid();
  let minXp=0;
  for(const [i,rank]of input.ranks.entries()){
    if(!record(rank)||rank.rank!==i+1||!integer(rank.division,1,5)||typeof rank.league!=='string'||typeof rank.name!=='string'||!integer(rank.deckPower,1,25)||!integer(rank.intelligence,1,25)||!integer(rank.minimumXp)||Number(rank.minimumXp)<minXp)return invalid();
    minXp=Number(rank.minimumXp);
  }
  const ids=new Set<string>();for(const id of input.starterIds){if(typeof id!=='string'||!id||ids.has(id))return invalid();ids.add(id);}
  let xp=0,power=1;
  for(const card of input.unlocks){if(!record(card)||typeof card.cardId!=='string'||!card.cardId||ids.has(card.cardId)||!integer(card.power,2,25)||Number(card.power)<power||!integer(card.xp)||Number(card.xp)<=xp)return invalid();ids.add(card.cardId);xp=Number(card.xp);power=Number(card.power);}
  return input as unknown as GrowthView;
}
export function decodeDeveloperStatus(input:unknown):DeveloperStatus{
  const invalid=()=>{throw Error('개발자 운영 상태 응답 형식 오류 · 배포 준비를 다시 확인하세요.');};
  const hash=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
  if(!record(input)||input.role!=='developer'||typeof input.version!=='string'||!integer(input.collectible)||input.rankCount!==25||input.growthHash!==undefined&&!hash(input.growthHash))return invalid();
  const ai=input.aiModel;if(ai!==undefined&&(!record(ai)||typeof ai.source!=='string'||!['local','release','default'].includes(ai.source)||!hash(ai.catalogHash)||!integer(ai.games)||!integer(ai.promotions)))return invalid();
  const runtime=input.runtime;
  if(runtime!==undefined){
    if(!record(runtime)||!record(runtime.rooms))return invalid();
    for(const key of ['total','playing','waiting','finished','account','accountPlaying','accountWaiting','ai'])if(!integer(runtime.rooms[key]))return invalid();
    for(const key of ['connectedSockets','pendingRoomWrites','failedRoomWrites','pendingResults','pendingCredentialChanges','pendingDeckChanges','uptimeSeconds','rssBytes'])if(!integer(runtime[key]))return invalid();
    for(const key of ['maintenance','maintenanceSaving','maintenanceSaved','readyForPatch'])if(typeof runtime[key]!=='boolean')return invalid();
    const worker=runtime.aiWorker;if(worker!==undefined&&(!record(worker)||!['active','queued','capacity'].every(key=>integer(worker[key]))))return invalid();
  }
  return input as unknown as DeveloperStatus;
}

export type PresenceSnapshot={key:string;room:AccountActiveRoom|null;failed?:boolean};
/** A response for an earlier account, reconnect or synchronization event is
 * not evidence that the account is currently free to start a new game. */
export function presenceState(key:string,snapshot:PresenceSnapshot|null):'loading'|'error'|'ready'{
  if(!key||snapshot?.key!==key)return 'loading';
  return snapshot.failed?'error':'ready';
}
export function decodeActivePresence(input:unknown):AccountActiveRoom|null{
  if(!input||typeof input!=='object'||!Object.hasOwn(input,'room'))throw Error('대전 상태 응답 형식 오류');
  const room=(input as {room:unknown}).room;if(room===null)return null;
  if(!room||typeof room!=='object'||Array.isArray(room))throw Error('대전 상태 응답 형식 오류');
  const r=room as AccountActiveRoom;
  if(!['ranked','developer-test','pvp'].includes(r.mode)||!['waiting','playing'].includes(r.status)||typeof r.connected!=='boolean'||typeof r.resumeAllowed!=='boolean'||r.mode==='pvp'&&r.rank!==undefined||r.mode!=='pvp'&&(!Number.isInteger(r.rank)||r.rank!<1||r.rank!>25))throw Error('대전 상태 응답 형식 오류');
  return r;
}

/** A status snapshot is evidence of a check, not an enduring authorization. */
export function developerPatchLabel(runtime:DeveloperRuntimeStatus|undefined,connected:boolean,maintenance:boolean,checkedAt:number,now:number,refreshFailed=false){
  if(!connected)return '서버 연결 끊김 · 재확인 필요';
  if(!maintenance)return '점검 모드 꺼짐';
  if(!runtime||runtime.maintenance!==maintenance||refreshFailed||now-checkedAt>15000)return '운영 상태 재확인 필요';
  if(runtime.maintenanceSaved!==true||runtime.maintenanceSaving!==false)return '점검 상태 저장 대기';
  if(runtime.pendingCredentialChanges!==0)return '비밀번호 변경·복구 종료 대기';
  if(runtime.pendingDeckChanges!==0)return '서버 덱 저장 종료 대기';
  if(runtime.readyForPatch===true&&runtime.rooms.accountPlaying===0&&runtime.rooms.accountWaiting===0&&runtime.pendingRoomWrites===0&&runtime.failedRoomWrites===0&&runtime.pendingResults===0)return '최근 조회 시 준비 완료 · 배포 직전 재확인';
  return '경기/저장 종료 대기 · 상태 새로 확인';
}

export function cardTierProgress(growth:GrowthView,owned:ReadonlySet<string>,xp:number){
  const cards=[...growth.starterIds.map(cardId=>({cardId,power:1,xp:0})),...growth.unlocks];
  return Array.from({length:25},(_,i)=>{const power=i+1,tier=cards.filter(card=>card.power===power),held=tier.filter(card=>owned.has(card.cardId)).length,next=tier.filter(card=>!owned.has(card.cardId)).sort((a,b)=>a.xp-b.xp)[0];return {power,total:tier.length,owned:held,nextXp:next?Math.max(0,next.xp-xp):null};});
}
