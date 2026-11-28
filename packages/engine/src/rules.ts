import type { BattleVisualEvent, GameState, HeroClass, PlayerId, Tribe } from './types.ts';

export const RULES = Object.freeze({ heroHealth: 30, deckSize: 30, maxCopies: 2, maxMana: 10, maxBoard: 7, maxHand: 10, maxSecrets: 5,maxTurns:89 });
export function maxCardCopies(card:{kind:string;rarity?:string;collectible?:boolean}|undefined):number{return !card||card.kind==='coin'||card.collectible===false?0:card.rarity==='legendary'?1:RULES.maxCopies;}
/** The strictest living, unsilenced time-limit aura applies to both players. */
export function turnTimeLimitSeconds(s:GameState):number|undefined {
  if(s.phase!=='playing')return;
  let seconds:number|undefined;
  for(const p of s.players)for(const m of p.board){const c=s.catalog[m.cardId];if(m.health>0&&!m.silenced&&c?.kind==='minion'&&c.turnTimeLimitSeconds!==undefined)seconds=Math.min(seconds??Infinity,c.turnTimeLimitSeconds);}
  return seconds;
}
export const HERO_CLASSES = ['warrior','shaman','rogue','paladin','hunter','druid','warlock','mage','priest'] as const;
export const TRIBES: readonly Tribe[] = ['beast','demon','dragon','murloc','pirate','totem','none'];
export class RuleError extends Error { constructor(message: string) { super(message); this.name = 'RuleError'; } }
export function requireRule(condition: unknown, message: string): asserts condition { if (!condition) throw new RuleError(message); }
export function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max; }
export function isClass(value: unknown): value is HeroClass { return HERO_CLASSES.some(c => c === value); }
export function other(id: PlayerId): PlayerId { return id === 0 ? 1 : 0; }
export function validPlayer(id: unknown): id is PlayerId { return id === 0 || id === 1; }
export interface RuntimeOptions { random?:()=>number; instanceId?:()=>string; visualEvent?:(event:BattleVisualEvent)=>void }
const runtimes=new WeakMap<GameState,RuntimeOptions>();
export function setRuntime(s:GameState,runtime?:RuntimeOptions):void {if(runtime)runtimes.set(s,runtime);}
export function opaqueId(s:GameState):string|undefined{return runtimes.get(s)?.instanceId?.();}
export function emitVisual(s:GameState,event:BattleVisualEvent):void {
  try{runtimes.get(s)?.visualEvent?.(event);}catch{/* Presentation observers cannot affect combat. */}
}
export function random(s: GameState): number {
  const source=runtimes.get(s)?.random;if(source)return source();
  // Reproducible simulation PRNG, to be replaced before online deployment.
  s.rng = (Math.imul(1664525, s.rng) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}

export function log(s:GameState,player:PlayerId,message:string):void{
  s.history.push({turn:s.turn,player,message});if(s.history.length>60)s.history.shift();
}
