import { applyAction, createGame, RuleError } from './engine.ts';
import { availableTargets, hasKeyword, effectiveTargetRule } from './effects.ts';
import type { Character } from './effects.ts';
import { getHeroPower } from './hero-powers.ts';
import { currentCost } from './costs.ts';
import type { Action, Catalog, Deck, GameState, PlayerId, Target, TargetRule } from './types.ts';
function toTarget(c:Character):Target{return c.kind==='hero'?{kind:'hero',player:c.player}:{kind:'minion',instanceId:c.minion.instanceId};}
function targets(s:GameState,actor:PlayerId,rule:TargetRule|undefined,optional=false,spellOrPower=false):(Target|undefined)[]{if(!rule)return[undefined];const list=availableTargets(s,actor,rule,spellOrPower).map(toTarget);return list.length?list:optional?[undefined]:[];}
export function candidates(s:GameState,actor:PlayerId):Action[]{
  if(s.phase==='finished')return[];
  const p=s.players[actor],enemy=actor===0?1:0;
  if(s.phase==='mulligan')return p.mulliganDone?[]:[{type:'mulligan',replace:p.hand.filter(c=>s.catalog[c.cardId].cost>=4).map(c=>c.instanceId)}];
  if(s.activePlayer!==actor)return[];
  if(s.pendingChoice)return s.pendingChoice.owner===actor?s.pendingChoice.cards.map(c=>({type:'chooseDeckCard',instanceId:c.instanceId})):[];
  const list:Action[]=[];
  const attackTargets:Target[]=[{kind:'hero',player:enemy},...s.players[enemy].board.filter(m=>!hasKeyword(m,'stealth')).map(m=>({kind:'minion' as const,instanceId:m.instanceId}))];
  for(const a of p.board)if(a.attacksRemaining>0&&a.attack>0&&a.frozenThroughTurn===undefined&&(a.silenced||!(s.catalog[a.cardId].kind==='minion'&&(s.catalog[a.cardId] as import('./types.ts').MinionCard).noAttack)))for(const target of attackTargets)list.push({type:'attack',attackerId:a.instanceId,target});
  if(p.heroAttacksRemaining>0&&p.heroAttack+(p.weapon?.attack??0)>0&&p.heroFrozenThroughTurn===undefined)for(const target of attackTargets)list.push({type:'heroAttack',target});
  for(const h of p.hand){const c=s.catalog[h.cardId];if(currentCost(c,s.catalog,actor,[s.players[0].board,s.players[1].board],p.weapon,h.costDiscount,p.nextSecretFree,p.minionsPlayedThisTurn,{handCount:p.hand.length,health:p.health,nextSpellDiscount:p.nextSpellDiscount,freeSpellsThisTurn:p.freeSpellsThisTurn,maxHealth:p.maxHealth})>p.mana||(c.kind==='minion'&&p.board.length>=7))continue;const rule=effectiveTargetRule(c,p.cardsPlayedThisTurn>0);const choices=c.kind==='spell'||c.kind==='minion'?c.choices:undefined;const position=c.kind==='minion'?Math.floor(p.board.length/2):undefined;if(choices){for(const [choice] of choices.entries())for(const target of targets(s,actor,effectiveTargetRule(c,p.cardsPlayedThisTurn>0,choice),c.kind==='minion',c.kind==='spell'))list.push({type:'playCard',instanceId:h.instanceId,target,position,choice});}else for(const target of targets(s,actor,rule,c.kind==='minion'||c.kind==='weapon',c.kind==='spell'))list.push({type:'playCard',instanceId:h.instanceId,target,position});}
  const power=getHeroPower(p);if(!p.heroPowerUsed&&p.mana>=power.cost)for(const target of targets(s,actor,power.targetRule,false,true))list.push({type:'heroPower',target});
  return list;
}
/** Noncompetitive test agent. Tries actions through the same engine as a human. */
export function simulate(catalog:Catalog,decks:[Deck,Deck],seed:number,onStep?:(state:GameState,action:Action)=>void):GameState{
  let s=createGame(catalog,decks,{seed}),botSeed=seed^0x12345678;
  const next=()=>{botSeed=(Math.imul(botSeed,1664525)+1013904223)>>>0;return botSeed/4294967296;};
  for(let i=0;i<600;i++){
    if(s.phase==='finished')return s;
    const actor=s.phase==='mulligan'?(s.players[0].mulliganDone?1:0):s.activePlayer;
    const options=candidates(s,actor);for(let j=options.length-1;j>0;j--){const k=Math.floor(next()*(j+1));[options[j],options[k]]=[options[k],options[j]];}
    if(s.phase==='playing')options.push({type:'endTurn'});
    let done=false;
    for(const action of options){try{s=applyAction(s,actor,action);onStep?.(s,action);done=true;break;}catch(e){if(!(e instanceof RuleError))throw e;}}
    if(!done)throw new Error('No legal simulation action');
  }
  throw new Error('Simulation exceeded 600 actions');
}
