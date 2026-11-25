import {DECK_STYLES,HERO_CLASSES,isBotDifficulty} from '../../../packages/engine/src/index.ts';
import type {BotDifficulty,DeckStyle,HeroClass,PlayerId} from '../../../packages/engine/src/index.ts';
import {ANIMATION_SPEEDS} from '../../../packages/protocol.ts';
import type {RoomView,AnimationSpeed} from '../../../packages/protocol.ts';
import {DEVICE_MODES} from './device-budget.ts';
import type {DeviceMode} from './device-budget.ts';
export const DECK_STYLE_LABELS:Record<DeckStyle,string>={starter:'입문',practice:'균형',aggression:'공격형',control:'컨트롤',synergy:'종족·연계',combo:'콤보',legendary:'전설 중심'};
export type SoloStyle=DeckStyle|'auto'|'random';
export type SoloClass=HeroClass|'random';
export type FirstSelection='random'|'first'|'second';
export interface SoloSettings{heroClass:SoloClass;difficulty:BotDifficulty;style:SoloStyle;first:FirstSelection;engine:'device'|'server';deviceMode:DeviceMode;animationSpeed:AnimationSpeed;}
export const DEFAULT_SOLO_SETTINGS:SoloSettings={heroClass:'mage',difficulty:3,style:'auto',first:'random',engine:'device',deviceMode:'auto',animationSpeed:'normal'};
const settingsKey='card-duel-solo-settings-v1',historyKey='card-duel-solo-history-v1';
type Store=Pick<Storage,'getItem'|'setItem'>;
function store():Store|undefined{try{return globalThis.localStorage;}catch{return undefined;}}
export function parseSoloSettings(raw:unknown):SoloSettings{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {...DEFAULT_SOLO_SETTINGS};
  const s=raw as Record<string,unknown>;
  return {heroClass:s.heroClass==='random'||HERO_CLASSES.includes(s.heroClass as HeroClass)?s.heroClass as SoloClass:'mage',difficulty:isBotDifficulty(s.difficulty)?s.difficulty:3,style:s.style==='random'||s.style==='auto'||DECK_STYLES.includes(s.style as DeckStyle)?s.style as SoloStyle:'auto',first:s.first==='first'||s.first==='second'?s.first:'random',engine:s.engine==='server'?'server':'device',deviceMode:DEVICE_MODES.includes(s.deviceMode as DeviceMode)?s.deviceMode as DeviceMode:'auto',animationSpeed:ANIMATION_SPEEDS.includes(s.animationSpeed as AnimationSpeed)?s.animationSpeed as AnimationSpeed:'normal'};
}
export function readSoloSettings(storage=store()):SoloSettings{try{return parseSoloSettings(JSON.parse(storage?.getItem(settingsKey)??'null'));}catch{return {...DEFAULT_SOLO_SETTINGS};}}
export function saveSoloSettings(s:SoloSettings,storage=store()):boolean{try{if(!storage)return false;storage.setItem(settingsKey,JSON.stringify(parseSoloSettings(s)));return true;}catch{return false;}}
export interface ResolvedSolo{heroClass:HeroClass;difficulty:BotDifficulty;style:DeckStyle;firstPlayer?:PlayerId;deviceMode:DeviceMode;seed:number;deckSeed:number;animationSpeed:AnimationSpeed;}
export function resolveSolo(s:SoloSettings,seed:number):ResolvedSolo{
  const choose=<T>(items:readonly T[],salt:number):T=>items[((Math.imul(seed^salt,0x9e3779b1)>>>0)%items.length)];
  const heroClass=s.heroClass==='random'?choose(HERO_CLASSES,1963):s.heroClass;
  const pool:DeckStyle[]=s.difficulty<=2?['starter']:s.difficulty<=5?['practice']:s.difficulty<=15?['practice','aggression','control','synergy','combo']:['legendary','aggression','control','synergy','combo','legendary'];
  const style=s.style==='auto'?choose(pool,401):s.style==='random'?choose(DECK_STYLES,401):s.style;
  return {heroClass,difficulty:s.difficulty,style,firstPlayer:s.first==='first'?0:s.first==='second'?1:undefined,deviceMode:s.deviceMode,animationSpeed:s.animationSpeed,seed:seed>>>0,deckSeed:(seed^0x9ef1672)>>>0};
}
export interface SoloResult{code:string;date:string;heroClass:HeroClass;opponent:HeroClass;difficulty:BotDifficulty;style?:DeckStyle;result:'win'|'loss'|'draw';turns:number;generation:number;catalogHash:string;}
function validResult(v:unknown):v is SoloResult{
  if(!v||typeof v!=='object')return false;const r=v as SoloResult;
  return typeof r.code==='string'&&r.code.length<=80&&typeof r.date==='string'&&Number.isFinite(Date.parse(r.date))&&HERO_CLASSES.includes(r.heroClass)&&HERO_CLASSES.includes(r.opponent)&&isBotDifficulty(r.difficulty)&&(r.style===undefined||DECK_STYLES.includes(r.style))&&['win','loss','draw'].includes(r.result)&&Number.isInteger(r.turns)&&r.turns>=0&&Number.isInteger(r.generation)&&r.generation>=0&&typeof r.catalogHash==='string';
}
export function readSoloHistory(storage=store()):SoloResult[]{try{const raw=JSON.parse(storage?.getItem(historyKey)??'[]');return Array.isArray(raw)?raw.filter(validResult).slice(0,100):[];}catch{return [];}}
/** Record only finished practice matches. Ranked history belongs to the account. */
export function resultFromRoom(room:RoomView,hash:string,date=new Date().toISOString()):SoloResult|null{
  const s=room.state;if(room.mode!=='bot'||room.ranked||room.developerFree||room.developerTest||s?.phase!=='finished')return null;
  return {code:room.code,date,heroClass:s.self.heroClass,opponent:s.opponent.heroClass,difficulty:room.botDifficulty??3,style:room.botDeckStyle,result:s.winner===null?'draw':s.winner===room.seat?'win':'loss',turns:s.turn,generation:room.botTrainingGeneration??0,catalogHash:hash};
}
export function recordSoloResult(result:SoloResult,storage=store(),inMemory:SoloResult[]=[]):SoloResult[]{
  const stored=readSoloHistory(storage),current=[...stored,...inMemory.filter(r=>!stored.some(x=>x.code===r.code))].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));if(current.some(r=>r.code===result.code))return current;
  const updated=[result,...current].slice(0,100);try{storage?.setItem(historyKey,JSON.stringify(updated));}catch{}return updated;
}
export function soloStats(results:SoloResult[],hash?:string){const list=hash?results.filter(r=>r.catalogHash===hash):results;const wins=list.filter(r=>r.result==='win').length,losses=list.filter(r=>r.result==='loss').length,draws=list.length-wins-losses;return {games:list.length,wins,losses,draws,winRate:list.length?Math.round((wins+.5*draws)/list.length*100):0};}
export type SoloHistoryVersion='all'|'current'|'previous';
export type SoloHistoryOutcome='all'|SoloResult['result'];
export function soloHistoryPage(history:readonly SoloResult[],hash:string,version:SoloHistoryVersion,outcome:SoloHistoryOutcome,page:number){
  const filtered=history.filter(r=>(version==='all'||(version==='current'?r.catalogHash===hash:r.catalogHash!==hash))&&(outcome==='all'||r.result===outcome));
  const pages=Math.max(1,Math.ceil(filtered.length/10)),current=Math.max(0,Math.min(pages-1,Number.isFinite(page)?Math.floor(page):0));
  return {items:filtered.slice(current*10,(current+1)*10),page:current,pages,stats:soloStats(filtered)};
}
