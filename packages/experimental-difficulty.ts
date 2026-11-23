import {rankBotActions} from './engine/src/index.ts';
import type {Action,BotDifficulty,BotOptions,Catalog,PlayerId,PlayerView} from './engine/src/index.ts';

/** Explicit developer-evaluation candidate. No normal ranked or training
 * policy selects this module. For identical public turn/seed/seat, the expert choice at one
 * level is also expert at every higher level. The game remains unchanged. */
export function expertProbability(level:BotDifficulty){return (level-1)/24;}
export function experimentDraw(seed:number,actor:PlayerId,turn:number){
  let x=(seed^Math.imul(actor+1,0x9e3779b1)^Math.imul(turn+1,0x85ebca6b))>>>0;
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);x=(x^(x>>>16))>>>0;
  return x/0x100000000;
}
export function experimentalPolicy(level:BotDifficulty,seed:number,actor:PlayerId,turn:number):1|25{
  return experimentDraw(seed,actor,turn)<expertProbability(level)?25:1;
}
/** Benchmark-only alternative: distribute expert choices across decisions rather
 * than whole turns. Uses public revision and turn, not hidden cards or resources. */
export function decisionMixturePolicy(level:BotDifficulty,seed:number,actor:PlayerId,turn:number,revision:number):1|25{
  return experimentalPolicy(level,(seed^Math.imul(revision+1,0xc2b2ae35))>>>0,actor,turn);
}
export function experimentalActions(view:PlayerView,catalog:Catalog,actor:PlayerId,level:BotDifficulty,seed:number,settings:BotOptions={}):Action[]{
  const selected=experimentalPolicy(level,seed,actor,view.turn);
  return rankBotActions(view,catalog,actor,selected,{...settings,policyVersion:selected===25?2:1});
}
