import type {Card,GameState,Minion,PlayerId,Tribe} from './types.ts';

export type CombatSource='spell'|'minion'|'weapon'|'power'|'card';
export type CombatCause={owner:PlayerId;source:CombatSource;area?:boolean};
export type CombatEvent=
  | {kind:'play';owner:PlayerId;card:Card;paid:number}
  | {kind:'summon';owner:PlayerId;card:Extract<Card,{kind:'minion'}>;shield:boolean}
  | {kind:'attack';owner:PlayerId;source:CombatSource;target:'hero'|'minion';tribe?:Tribe}
  | {kind:'damage';owner:PlayerId;source:CombatSource;target:'hero'|'minion';side:PlayerId;amount:number;ownTurn:number}
  | {kind:'death';owner:PlayerId;source:CombatSource;side:PlayerId;area?:boolean}
  | {kind:'draw'|'power'|'combo'|'choose'|'freeze'|'silence'|'shieldGain';owner:PlayerId}
  | {kind:'armor'|'heal'|'minionHeal'|'buff'|'healthBuff'|'mana'|'overload';owner:PlayerId;amount:number};

type Observation={emit:(event:CombatEvent)=>void;mortal:WeakMap<Minion,CombatCause>};
const observations=new WeakMap<GameState,Observation>();
export function setCombatObserver(s:GameState,emit:(event:CombatEvent)=>void){
  observations.set(s,{emit,mortal:new WeakMap()});
}
export function observingCombat(s:GameState){return observations.has(s);}
export function emitCombat(s:GameState,event:CombatEvent){
  try{observations.get(s)?.emit(event);}catch{/* Observers cannot change resolution. */}
}
export function markMortal(s:GameState,minion:Minion,cause:CombatCause){
  const mortal=observations.get(s)?.mortal;if(mortal&&!mortal.has(minion))mortal.set(minion,cause);
}
export function clearMortal(s:GameState,minion:Minion){observations.get(s)?.mortal.delete(minion);}
export function observedDeath(s:GameState,minion:Minion,side:PlayerId){
  const cause=observations.get(s)?.mortal.get(minion);
  if(cause)emitCombat(s,{kind:'death',side,...cause});
}
export function observeDamage(s:GameState,cause:CombatCause|undefined,side:PlayerId,target:'hero'|'minion',amount:number){
  if(!cause||amount<=0)return;
  const ownTurn=s.activePlayer===cause.owner?Math.floor((s.turn+(s.firstPlayer===cause.owner?1:0))/2):0;
  emitCombat(s,{kind:'damage',owner:cause.owner,source:cause.source,target,side,amount,ownTurn});
}
export function observedSummon(s:GameState,owner:PlayerId,minion:Minion){
  const card=s.catalog[minion.cardId];
  if(card?.kind==='minion')emitCombat(s,{kind:'summon',owner,card,shield:minion.keywords?.includes('divineShield')??false});
}
