import type { Deck, HeroClass, PlayerId, PlayerView, Action, BotDifficulty, Target, BattleVisualEvent, BotWeights, DeckStyle } from './engine/src/index.ts';
import type {RankedRewardSummary} from './account-protocol.ts';
/** Only accepted, public actions are shared. Secret identities, hand instance IDs and deck choices never appear here. */
export type BattleAnimationKind='summon'|'spell'|'weapon'|'secret'|'coin'|'attack'|'heroAttack'|'power'|'turn'|'choice';
export interface BattleAnimation {
  revision:number; actor:PlayerId; kind:BattleAnimationKind;
  cardId?:string; attackerId?:string; target?:Target; heavy?:boolean; choice?:number;
  blocked?:boolean; events?:BattleVisualEvent[];
}
/** The same timing controls the client playback and the default AI pacing. */
export function battleAnimationTiming(animation:BattleAnimation):{duration:number;impact:number}{
  const timing=baseBattleAnimationTiming(animation);
  const events=animation.events??[];
  const recovery=events.some(event=>event.kind==='death')?1700:events.some(event=>event.kind==='secretTriggered')?1500:0;
  return {duration:Math.max(timing.duration*2,timing.impact*2+recovery),impact:timing.impact*2};
}
function baseBattleAnimationTiming(animation:BattleAnimation):{duration:number;impact:number}{
  switch(animation.kind){
    case 'attack':return {duration:animation.heavy?1200:1000,impact:animation.heavy?510:430};
    case 'heroAttack':return {duration:1250,impact:520};
    case 'spell':return {duration:animation.heavy?1900:1250,impact:animation.heavy?850:550};
    case 'summon':return animation.heavy?{duration:1800,impact:1350}:{duration:1400,impact:1050};
    case 'weapon':return {duration:1050,impact:530};
    case 'secret':return {duration:1050,impact:540};
    case 'coin':return {duration:900,impact:420};
    case 'power':return {duration:1100,impact:500};
    case 'turn':return {duration:800,impact:180};
    case 'choice':return {duration:650,impact:240};
  }
}
export const ANIMATION_SPEEDS=['normal','fast','instant'] as const;
export type AnimationSpeed=typeof ANIMATION_SPEEDS[number];
export function scaledBattleTiming(animation:BattleAnimation,speed:AnimationSpeed='normal'){
  const timing=battleAnimationTiming(animation),scale=speed==='instant'?0:speed==='fast'?.55:1;
  return {duration:Math.round(timing.duration*scale),impact:Math.round(timing.impact*scale)};
}
export interface RoomView { code:string; seat:PlayerId; mode:'human'|'bot'; botDifficulty?:BotDifficulty; botTrainingGeneration?:number; botEngine?:'server'|'device'; botDeckStyle?:DeckStyle; animationSpeed?:AnimationSpeed; status:'waiting'|'playing'|'finished'; opponentConnected:boolean; state:PlayerView|null; animation?:BattleAnimation; turnDeadlineMs?:number; opponentReconnectDeadlineMs?:number; ranked?:{rank:number;deckPower:number;intelligence:number;reward:'pending'|'saved'|'notEligible';rewardDetails?:RankedRewardSummary}; developerTest?:{rank:number;deckPower:number;intelligence:number;experiment?:'mixture-v1'};ownedPvp?:boolean;pvpReward?:'pending'|'saved' }
export interface PublicAiProfile{catalogHash:string;weights:BotWeights;generation:number;}
export type FailureCode='sessionInvalid'|'roomExpired'|'staleRevision'|'rateLimit'|'opponentDisconnected'|'serverError'|'ticketExpired'|'accountChanged';
export type Result<T>={ok:true;data:T}|{ok:false;error:string;code?:FailureCode};
export interface Session {code:string;token:string;seat:PlayerId}
export interface JoinTicket {ticket:string}
export interface ClientEvents {
  'account:watch':(reply:(result:Result<null>)=>void)=>void;
  'room:create':(deck:Deck|({deck:Deck}&JoinTicket),reply:(result:Result<Session>)=>void)=>void;
  'room:bot':(input:{deck:Deck;heroClass:HeroClass;difficulty?:BotDifficulty;style?:DeckStyle;firstPlayer?:PlayerId;deckSeed?:number;ticket?:string},reply:(result:Result<Session>)=>void)=>void;
  'room:ranked':(input:{deck:Deck;ticket?:string;expectedAccountId?:string},reply:(result:Result<Session>)=>void)=>void;
  'room:developer-test':(input:{deck:Deck;rank:number;ticket?:string;expectedAccountId?:string},reply:(result:Result<Session>)=>void)=>void;
  'room:owned-create':(input:{deck:Deck;ticket?:string;expectedAccountId?:string},reply:(result:Result<Session>)=>void)=>void;
  'room:owned-join':(input:{code:string;deck:Deck;ticket?:string;expectedAccountId?:string},reply:(result:Result<Session>)=>void)=>void;
  'room:owned-match':(input:{deck:Deck;ticket?:string;expectedAccountId?:string},reply:(result:Result<Session>)=>void)=>void;
  'room:account-resume':(input:{ticket?:string;expectedAccountId?:string},reply:(result:Result<Session>)=>void)=>void;
  'room:account-pause':(reply:(result:Result<null>)=>void)=>void;
  'room:join':(input:{code:string;deck:Deck;ticket?:string},reply:(result:Result<Session>)=>void)=>void;
  'room:recover':(input:JoinTicket,reply:(result:Result<Session>)=>void)=>void;
  'room:resume':(input:{code:string;token:string},reply:(result:Result<Session>)=>void)=>void;
  'room:action':(input:{revision:number;action:Action},reply:(result:Result<RoomView>)=>void)=>void;
  'room:sync':(reply:(result:Result<RoomView>)=>void)=>void;
  'room:leave':(reply:(result:Result<null>)=>void)=>void;
}
export interface ServerEvents { 'server:catalog':(hash:string)=>void; 'server:version':(version:string)=>void; 'server:maintenance':(enabled:boolean)=>void; 'account:changed':()=>void; 'account:room-changed':()=>void; 'room:view':(view:RoomView)=>void; 'room:error':(message:string)=>void; 'room:expired':(event:{code:string;reason:string})=>void }
