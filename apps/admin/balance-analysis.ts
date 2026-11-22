import {applyAction,cardRoles,createGame,DECK_STYLES,getPlayerView,HERO_CLASSES,rankBotActions,RuleError,strategicDeck,validateDeck} from '../../packages/engine/src/index.ts';
import type {Catalog,Card,Deck,GameState,HeroClass,PlayerId} from '../../packages/engine/src/index.ts';

type Collectible=Exclude<Card,{kind:'coin'}>;
const eligible=(catalog:Catalog)=>Object.values(catalog).filter((c):c is Collectible=>c.kind!=='coin'&&c.collectible!==false);
const round=(n:number)=>Math.round(n*100)/100;
const median=(values:number[])=>{const a=[...values].sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
/** A descriptive heuristic, not an estimated win rate. Compare like cost/type
 * peers only; small groups and conditional effects must be reviewed by hand. */
export function analyzeBalance(base:Catalog,draft:Catalog){
  const cards=eligible(draft),roles=new Map(cards.map(c=>[c.id,cardRoles(c,draft)]));
  const score=(c:Collectible,catalog:Catalog)=>{const r=cardRoles(c,catalog);return r.tempo+r.reach*.45+r.removal*.85+r.draw*.8+r.sustain*.55+r.synergy*.35+r.value*.65;};
  const groups=new Map<string,number[]>();for(const c of cards){const k=`${c.kind}:${c.cost}`;groups.set(k,[...(groups.get(k)??[]),score(c,draft)]);}
  const rows=cards.map(c=>{const group=groups.get(`${c.kind}:${c.cost}`)!,value=score(c,draft),center=median(group),old=base[c.id],before=old&&old.kind!=='coin'?score(old,base):null;
    return{id:c.id,name:c.name,class:c.class,kind:c.kind,rarity:c.rarity,cost:c.cost,oldCost:old?.cost??null,score:round(value),oldScore:before===null?null:round(before),peerMedian:round(center),peerCount:group.length,delta:round(value-center),roles:roles.get(c.id)!,changed:JSON.stringify(old)!==JSON.stringify(c),flag:group.length<5?'fewPeers':value-center>=Math.max(2.5,Math.abs(center)*.45)?'high':center-value>=Math.max(2.5,Math.abs(center)*.45)?'low':'typical'};
  });
  const classes=['neutral',...HERO_CLASSES] as const;
  return{rows,classes:classes.map(klass=>{const pool=cards.filter(c=>c.class===klass);return{class:klass,count:pool.length,curve:Array.from({length:12},(_,i)=>pool.filter(c=>Math.min(11,c.cost)===i).length),kinds:Object.fromEntries(['minion','spell','weapon','secret'].map(k=>[k,pool.filter(c=>c.kind===k).length]))};})};
}

export interface BalanceConfig {pairs:number;seed:number;level:6|11|18;focus?:string;newFocus?:boolean}
export function parseBalanceConfig(input:Record<string,unknown>,base:Catalog,draft:Catalog):BalanceConfig{
  const pairs=input.pairs??9,seed=input.seed??20241122,level=input.level??11,focus=input.focus;
  if(typeof pairs!=='number'||!Number.isInteger(pairs)||pairs<1||pairs>54)throw new RuleError('시험 묶음은 1~54개입니다.');
  if(typeof seed!=='number'||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RuleError('시드는 0~4294967295 정수입니다.');
  if(level!==6&&level!==11&&level!==18)throw new RuleError('시험 AI 단계는 6, 11, 18 중 하나입니다.');
  if(focus!==undefined&&focus!==''){
    if(typeof focus!=='string'||!eligible(draft).some(c=>c.id===focus))throw new RuleError('집중 시험 카드는 초안에서 덱 구성에 사용할 수 있어야 합니다.');
    const old=base[focus],next=draft[focus];if(old&&(old.kind==='coin'||old.collectible===false||next.kind==='coin'||old.class!==next.class))throw new RuleError('기존 카드의 집중 시험에서는 카드 직업과 덱 편입 여부를 유지하세요.');
    return{pairs,seed,level,focus,...(!old?{newFocus:true}:{})};
  }return{pairs,seed,level};
}
type Exposure={deckGames:number;handGames:number;playedGames:number;plays:number;playedWins:number;playedDraws:number};
type ClassResults={games:number;wins:number;draws:number};
export type Sample={matches:number;finished:number;truncated:number;moves:number;turns:number;firstWins:number;draws:number;classes:Record<HeroClass,ClassResults>;cards:Record<string,Exposure>};
export interface BalanceResult {original:Sample;draft:Sample;completedPairs:number;changedOutcomes:number;pairedPilotGain:number;pilotOriginalPoints:number;pilotDraftPoints:number;pilotGains:number;pilotLosses:number;pilotTies:number;config:BalanceConfig}
const sample=():Sample=>({matches:0,finished:0,truncated:0,moves:0,turns:0,firstWins:0,draws:0,classes:Object.fromEntries(HERO_CLASSES.map(c=>[c,{games:0,wins:0,draws:0}])) as Sample['classes'],cards:Object.create(null)});
function exposure(out:Sample,id:string){return out.cards[id]??=( {deckGames:0,handGames:0,playedGames:0,plays:0,playedWins:0,playedDraws:0});}
function withFocus(deck:Deck,base:Catalog,draft:Catalog,focus:string|undefined):[Deck,Deck]{
  if(!focus)return[deck,deck];const d=draft[focus],c=base[focus]??d;if(c.kind==='coin'||d.kind==='coin'||![c.class,d.class].every(k=>k==='neutral'||k===deck.heroClass))return[deck,deck];
  if(deck.cards.includes(focus))return[deck,deck];
  // A new card has no original definition. Replace its nearest existing
  // same-kind/cost slot only in the draft; compare both seats as before.
  const cards=[...deck.cards],index=cards.map((id,i)=>({i,distance:Math.abs(base[id].cost-c.cost)+(base[id].kind===c.kind?0:20)})).sort((a,b)=>a.distance-b.distance)[0].i;cards[index]=focus;
  const next={...deck,cards};validateDeck(next,draft);if(!base[focus])return[deck,next];validateDeck(next,base);return[next,next];
}
/** Identical legal deck lists, shuffle seed, first seat and fixed bot budget in
 * both catalogs. The two seats exchange decks. No active version is modified. */
function runMatch(catalog:Catalog,decks:[Deck,Deck],seed:number,level:BalanceConfig['level'],out:Sample):PlayerId|null{
  let state=createGame(catalog,decks,{seed,firstPlayer:0}),moves=0,turnActions=0,lastTurn=-1;
  const seen=[new Set<string>(),new Set<string>()],plays=[new Map<string,number>(),new Map<string,number>()];
  function observe(){for(const p of [0,1] as const)for(const h of state.players[p].hand)if(state.catalog[h.cardId]?.kind!=='coin')seen[p].add(h.cardId);}
  observe();
  while(state.phase!=='finished'&&moves<600){
    const actor:PlayerId=state.phase==='mulligan'?(state.players[0].mulliganDone?1:0):state.activePlayer;
    if(lastTurn!==state.turn){lastTurn=state.turn;turnActions=0;}
    const actions=turnActions>=40&&state.phase==='playing'&&!state.pendingChoice?[{type:'endTurn'} as const]:rankBotActions(getPlayerView(state,actor),state.catalog,actor,level,{nodeLimit:level===18?80:45,responseLimit:0,policyVersion:1});
    let after:GameState|undefined;
    for(const a of actions){try{after=applyAction(state,actor,a);if(a.type==='playCard'){const id=state.players[actor].hand.find(c=>c.instanceId===a.instanceId)?.cardId;if(id&&state.catalog[id].kind!=='coin')plays[actor].set(id,(plays[actor].get(id)??0)+1);}break;}catch(e){if(!(e instanceof RuleError))throw e;}}
    if(!after)throw Error('Balance trial: no legal action');state=after;observe();moves++;turnActions++;
  }
  out.matches++;out.moves+=moves;out.turns+=state.turn;
  if(state.phase!=='finished'){out.truncated++;return null;}
  out.finished++;out.firstWins+=Number(state.winner===0);out.draws+=Number(state.winner===null);
  for(const seat of [0,1] as const){const c=out.classes[decks[seat].heroClass];c.games++;c.wins+=Number(state.winner===seat);c.draws+=Number(state.winner===null);
    for(const id of new Set(decks[seat].cards))exposure(out,id).deckGames++;
    for(const id of seen[seat])exposure(out,id).handGames++;
    for(const [id,count] of plays[seat]){const r=exposure(out,id);r.playedGames++;r.plays+=count;r.playedWins+=Number(state.winner===seat);r.playedDraws+=Number(state.winner===null);}
  }return state.winner;
}
export function compareBalanceMatches(base:Catalog,draft:Catalog,config:BalanceConfig,onProgress?:(result:BalanceResult)=>void,signal?:()=>boolean):BalanceResult{
  const result:BalanceResult={original:sample(),draft:sample(),completedPairs:0,changedOutcomes:0,pairedPilotGain:0,pilotOriginalPoints:0,pilotDraftPoints:0,pilotGains:0,pilotLosses:0,pilotTies:0,config};
  let rng=config.seed>>>0;const next=()=>rng=(Math.imul(rng,1664525)+1013904223)>>>0;
  const focus= config.focus?draft[config.focus]:undefined;
  for(let i=0;i<config.pairs&&!signal?.();i++){
    const cls=focus&&focus.kind!=='coin'&&focus.class!=='neutral'?focus.class:HERO_CLASSES[(i+config.seed)%9],other=HERO_CLASSES[(i+1+Math.floor(i/9)+config.seed)%9];
    const [a,draftA]=withFocus(strategicDeck(base,cls,DECK_STYLES[i%DECK_STYLES.length],next()),base,draft,config.focus),b=strategicDeck(base,other,DECK_STYLES[(i+3)%DECK_STYLES.length],next());
    validateDeck(draftA,draft);validateDeck(b,draft);const seed=next();let pointsOld=0,pointsNew=0,valid=true;
    for(const seat of [0,1] as const){const decks:[Deck,Deck]=seat===0?[a,b]:[b,a],draftDecks:[Deck,Deck]=seat===0?[draftA,b]:[b,draftA];const caps=result.original.truncated+result.draft.truncated;
      const old=runMatch(base,decks,seed,config.level,result.original),fresh=runMatch(draft,draftDecks,seed,config.level,result.draft);
      if(caps!==result.original.truncated+result.draft.truncated){valid=false;continue;}
      result.changedOutcomes+=Number(old!==fresh);pointsOld+=old===null?.5:old===seat?1:0;pointsNew+=fresh===null?.5:fresh===seat?1:0;
    }
    if(valid){const gain=pointsNew-pointsOld;result.pairedPilotGain+=gain;result.pilotOriginalPoints+=pointsOld;result.pilotDraftPoints+=pointsNew;result.pilotGains+=Number(gain>0);result.pilotLosses+=Number(gain<0);result.pilotTies+=Number(gain===0);}
    result.completedPairs++;onProgress?.(result);
  }return result;
}
