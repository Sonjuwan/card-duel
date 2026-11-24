import {applyAction,createGame,getPlayerView,isBotDifficulty,rankBotActions,strategicDeck,DECK_STYLES,validateDeck,turnTimeLimitSeconds,RuleError,validateBotWeights,HERO_CLASSES,RULES} from '../../../packages/engine/src/index.ts';
import type {Action,BattleVisualEvent,GameState,Catalog,Deck,HeroClass,BotDifficulty,BotWeights,PlayerId,DeckStyle} from '../../../packages/engine/src/index.ts';
import {describeAcceptedAction} from '../../../packages/battle-animation.ts';
import {scaledBattleTiming,ANIMATION_SPEEDS} from '../../../packages/protocol.ts';
import type {BattleAnimation,RoomView,AnimationSpeed} from '../../../packages/protocol.ts';
import {deviceBudget} from './device-budget.ts';
import type {DeviceInfo,DeviceMode} from './device-budget.ts';
import type {MatchAward,AccountProfile} from '../../../packages/account-protocol.ts';
import type {OfflineRankContext,OfflineDeveloperContext} from './offline-growth.ts';
import {experimentalPolicy} from '../../../packages/experimental-difficulty.ts';
const opaqueCardId=()=>typeof globalThis.crypto!=='undefined'?Array.from(crypto.getRandomValues(new Uint32Array(4)),x=>x.toString(16).padStart(8,'0')).join(''):Array.from({length:4},()=>Math.floor(Math.random()*4294967296).toString(16).padStart(8,'0')).join('');

export interface LocalDuelInput{
  catalog:Catalog;deck:Deck;heroClass:HeroClass;difficulty:BotDifficulty;seed:number;code:string;
  style?:DeckStyle;weights?:BotWeights;generation?:number;deviceMode?:DeviceMode;device?:DeviceInfo;
  firstPlayer?:PlayerId;deckSeed?:number;animationSpeed?:AnimationSpeed;catalogHash?:string;
  ranked?:OfflineRankContext;
  developerTest?:OfflineDeveloperContext;
}
export interface LocalSaveSummary{catalogHash:string;code:string;heroClass:HeroClass;opponent:HeroClass;difficulty:BotDifficulty;turn:number;phase:GameState['phase'];revision:number;savedAt:string;rank?:number;testRank?:number;testExperiment?:'mixture-v1';}
export interface LocalSlotOverview{initialized:boolean;rank:number;xp:number;ownedCards:number;save:LocalSaveSummary|null;otherSaves:number;otherActiveRanked:boolean;}
/** Private snapshot: never include this in any message to the React renderer. */
export interface LocalDuelCheckpoint{schema:1;catalogHash:string;summary:LocalSaveSummary;input:Omit<LocalDuelInput,'catalog'|'device'>;state:Omit<GameState,'catalog'>;remainingMs?:number;botTurn:number;botActions:number;}
const integer=(n:unknown,min:number,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
export function publicSaveSummary(saved:LocalDuelCheckpoint,hash:string):LocalSaveSummary{
  const s=saved?.summary;if(saved?.schema!==1||saved.catalogHash!==hash||s?.catalogHash!==hash||typeof s.code!=='string'||!s.code||s.code.length>128||!HERO_CLASSES.includes(s.heroClass)||!HERO_CLASSES.includes(s.opponent)||!isBotDifficulty(s.difficulty)||!integer(s.turn,0,RULES.maxTurns)||!integer(s.revision,0)||!['mulligan','playing','finished'].includes(s.phase)||typeof s.savedAt!=='string'||!Number.isFinite(Date.parse(s.savedAt)))throw new RuleError('손상된 경기 저장 데이터');
  if(s.rank!==saved.input?.ranked?.rank||s.rank!==undefined&&!integer(s.rank,1,25)||s.testRank!==saved.input?.developerTest?.rank||s.testRank!==undefined&&!integer(s.testRank,1,25)||s.testExperiment!==saved.input?.developerTest?.experiment||s.testExperiment!==undefined&&(s.testExperiment!=='mixture-v1'||s.testRank===undefined||s.rank!==undefined))throw new RuleError('손상된 랭크 경기 저장 데이터');
  return {catalogHash:hash,code:s.code,heroClass:s.heroClass,opponent:s.opponent,difficulty:s.difficulty,turn:s.turn,phase:s.phase,revision:s.revision,savedAt:s.savedAt,...(s.rank!==undefined?{rank:s.rank}:{}),...(s.testRank!==undefined?{testRank:s.testRank}:{}),...(s.testExperiment?{testExperiment:s.testExperiment}:{})};
}
function checkSavedState(s:Omit<GameState,'catalog'>,catalog:Catalog){
  if(!s||!['mulligan','playing','finished'].includes(s.phase)||!integer(s.revision,0)||!integer(s.rng,0,0xffffffff)||!integer(s.nextId,1)||!integer(s.turn,0,RULES.maxTurns)||![0,1].includes(s.firstPlayer)||![0,1].includes(s.activePlayer)||!Array.isArray(s.players)||s.players.length!==2||!Array.isArray(s.history)||s.history.length>60||s.phase==='finished'&&(![null,0,1].includes(s.winner)||!['health','fatigue','concede','turnLimit'].includes(s.reason??''))||s.phase!=='finished'&&(s.winner!==null||s.reason!==null))throw new RuleError('저장 경기의 상태가 손상되었습니다.');
  const ids=new Set<string>();const card=(c:{instanceId:string;cardId:string})=>{if(!c||typeof c.instanceId!=='string'||!c.instanceId||ids.has(c.instanceId)||!Object.hasOwn(catalog,c.cardId))throw new RuleError('저장 경기의 카드가 올바르지 않습니다.');ids.add(c.instanceId);};
  for(const p of s.players){if(!p||!HERO_CLASSES.includes(p.heroClass)||!integer(p.maxHealth??30,1,30)||!integer(p.health,0,p.maxHealth??30)||!integer(p.armor,0)||!integer(p.mana,0,10)||!integer(p.maxMana,0,10)||!integer(p.heroAttack,0)||!integer(p.heroAttacksRemaining,0,2)||!integer(p.pendingOverload,0)||!integer(p.lockedMana,0,10)||!integer(p.cardsPlayedThisTurn,0)||typeof p.heroPowerUsed!=='boolean'||!Array.isArray(p.hand)||p.hand.length>10||!Array.isArray(p.deck)||!Array.isArray(p.board)||p.board.length>7||!Array.isArray(p.secrets)||p.secrets.length>5||!integer(p.fatigue,0)||typeof p.mulliganDone!=='boolean')throw new RuleError('저장 경기의 플레이어 상태가 손상되었습니다.');
    for(const c of [...p.hand,...p.deck,...p.secrets,...p.board])card(c);for(const m of p.board)if(catalog[m.cardId].kind!=='minion'||!integer(m.attack,0)||!integer(m.health,1,m.maxHealth)||!integer(m.attacksRemaining,0,2))throw new RuleError('저장 경기의 하수인 상태가 손상되었습니다.');
    if(p.weapon&&(!integer(p.weapon.attack,0)||!integer(p.weapon.durability,1)||p.weapon.cardId&&!Object.hasOwn(catalog,p.weapon.cardId)))throw new RuleError('저장 경기의 무기 상태가 손상되었습니다.');if(p.secrets.some(c=>catalog[c.cardId].kind!=='secret'))throw new RuleError('저장 경기의 비밀 카드가 올바르지 않습니다.');
  }
  if(s.pendingChoice){if(s.phase!=='playing'||s.pendingChoice.owner!==s.activePlayer||!Array.isArray(s.pendingChoice.cards)||!s.pendingChoice.cards.length||s.pendingChoice.cards.length>10)throw new RuleError('저장 경기의 선택 상태가 손상되었습니다.');for(const c of s.pendingChoice.cards)card(c);}
  if(s.history.some(e=>!e||!integer(e.turn,0,RULES.maxTurns)||![0,1].includes(e.player)||typeof e.message!=='string'))throw new RuleError('저장 경기의 기록이 손상되었습니다.');
}
/** Local solo authority lives exclusively inside the worker. Only the same
 * public RoomView used by online matches is emitted to the UI. */
export class LocalDuel{
  private state:GameState;
  private animation?:BattleAnimation;
  private deadline?:number;
  private timedTurn?:number;
  private limit?:number;
  private botTurn=-1;
  private botActions=0;
  readonly style:DeckStyle;
  private readonly input:LocalDuelInput;
  constructor(input:LocalDuelInput){
    this.input={...input,deckSeed:input.deckSeed??((input.seed^0x9ef1672)>>>0)};
    if(!isBotDifficulty(input.difficulty))throw new RuleError('잘못된 AI 난이도');
    validateDeck(input.deck,input.catalog);
    this.style=input.style??(input.difficulty>=16?'legendary':'practice');
    if(!DECK_STYLES.includes(this.style))throw new RuleError('잘못된 AI 덱 스타일');
    if(input.animationSpeed!==undefined&&!ANIMATION_SPEEDS.includes(input.animationSpeed))throw new RuleError('잘못된 연출 속도');
    const ranked=input.ranked,tier=ranked??input.developerTest;
    if(ranked&&Object.hasOwn(ranked,'experiment')||input.developerTest?.experiment!==undefined&&input.developerTest.experiment!=='mixture-v1')throw new RuleError('실험 AI는 개발자 시험에서만 사용할 수 있습니다.');
    if(ranked&&input.developerTest||ranked&&!integer(ranked.profileRevision,0)||tier&&(!integer(tier.rank,1,25)||!integer(tier.deckPower,1,25)||tier.intelligence!==input.difficulty||tier.opponentDeck?.heroClass!==input.heroClass))throw new RuleError('저장 랭크 설정이 손상되었습니다.');
    const opponent=tier?tier.opponentDeck:strategicDeck(input.catalog,input.heroClass,this.style,this.input.deckSeed);
    validateDeck(opponent,input.catalog);
    this.state=createGame(input.catalog,[input.deck,opponent],{seed:input.seed,firstPlayer:input.firstPlayer,runtime:{instanceId:opaqueCardId}});
  }
  checkpoint(now=Date.now()):LocalDuelCheckpoint|null{
    const hash=this.input.catalogHash;if(!hash||!/^[a-f0-9]{64}$/.test(hash))return null;
    const {catalog:_,device:__,...input}=this.input,{catalog:___,...state}=this.state;
    return structuredClone({schema:1,catalogHash:hash,summary:{catalogHash:hash,code:this.input.code,heroClass:state.players[0].heroClass,opponent:state.players[1].heroClass,difficulty:this.input.difficulty,turn:state.turn,phase:state.phase,revision:state.revision,savedAt:new Date(now).toISOString(),...(input.ranked?{rank:input.ranked.rank}:{}),...(input.developerTest?{testRank:input.developerTest.rank}:{}),...(input.developerTest?.experiment?{testExperiment:input.developerTest.experiment}:{})},input:{...input,style:this.style},state,...(this.deadline!==undefined?{remainingMs:Math.max(0,this.deadline-now)}:{}),botTurn:this.botTurn,botActions:this.botActions});
  }
  static restore(saved:LocalDuelCheckpoint,catalog:Catalog,hash:string,device?:DeviceInfo,now=Date.now()):LocalDuel{
    publicSaveSummary(saved,hash);
    if(!/^[a-f0-9]{64}$/.test(hash)||saved.input?.catalogHash!==hash||saved.summary.code!==saved.input.code||saved.summary.difficulty!==saved.input.difficulty||!integer(saved.input.seed,0,0xffffffff)||!integer(saved.input.deckSeed,0,0xffffffff)||!integer(saved.input.generation??0,0)||saved.input.firstPlayer!==undefined&&![0,1].includes(saved.input.firstPlayer)||saved.input.deviceMode!==undefined&&!['auto','fast','strong'].includes(saved.input.deviceMode)||!integer(saved.botTurn,-1,RULES.maxTurns)||!integer(saved.botActions,0,600)||saved.input.weights&&!validateBotWeights(saved.input.weights))throw new RuleError('현재 카드 버전과 일치하지 않거나 손상된 저장 경기입니다.');
    const duel=new LocalDuel({...saved.input,catalog,device});const state=structuredClone(saved.state);checkSavedState(state,duel.state.catalog);
    if(saved.summary.revision!==state.revision||saved.summary.phase!==state.phase||saved.summary.turn!==state.turn||saved.summary.heroClass!==state.players[0].heroClass||saved.summary.opponent!==state.players[1].heroClass||saved.input.deck.heroClass!==state.players[0].heroClass||saved.input.heroClass!==state.players[1].heroClass)throw new RuleError('저장 경기의 요약이 일치하지 않습니다.');
    duel.state={...state,catalog:duel.state.catalog};duel.botTurn=saved.botTurn;duel.botActions=saved.botActions;duel.updateClock(now);
    if(duel.deadline!==undefined){if(!integer(saved.remainingMs,0,duel.limit!*1000))throw new RuleError('저장 경기의 남은 시간이 손상되었습니다.');duel.deadline=now+saved.remainingMs!;}else if(saved.remainingMs!==undefined)throw new RuleError('저장 경기의 시간 제한이 일치하지 않습니다.');
    return duel;
  }
  /** An abandoned game is an immediate concession, including during mulligan.
   * Unlike a normal move, it must work even when a restored turn timer expired. */
  forfeit():RoomView{
    if(this.state.phase!=='finished')this.apply(0,{type:'concede'});
    return this.view();
  }
  rematch(code:string,seed:number){if(this.input.ranked)throw new RuleError('랭크 대전은 현재 성장 기록에서 새로 시작하세요.');if(this.state.phase!=='finished')throw new RuleError('경기가 끝난 후 다시 대전할 수 있습니다.');return new LocalDuel({...this.input,code,seed,style:this.style});}
  rankedAward():MatchAward|undefined{
    if(!this.input.ranked||this.state.phase!=='finished')return;
    const outcome=this.state.winner===0?'win':this.state.winner===1?'loss':'draw';
    return {matchId:this.input.code,rank:this.input.ranked.rank,heroClass:this.state.players[0].heroClass,opponentClass:this.state.players[1].heroClass,turns:this.state.turn,outcome,mode:'ranked',eligible:outcome==='win'||this.state.reason!=='concede'||this.state.turn>=6};
  }
  view():RoomView{
    const ranked=this.input.ranked;
    return {code:this.input.code,seat:0,mode:'bot',botEngine:'device',botDifficulty:this.input.difficulty,botTrainingGeneration:this.input.generation??0,botDeckStyle:this.style,animationSpeed:this.input.animationSpeed??'normal',status:this.state.phase==='finished'?'finished':'playing',opponentConnected:true,state:getPlayerView(this.state,0),...(ranked?{ranked:{rank:ranked.rank,deckPower:ranked.deckPower,intelligence:ranked.intelligence,reward:'pending' as const}}:{}),...(this.input.developerTest?{developerTest:{rank:this.input.developerTest.rank,deckPower:this.input.developerTest.deckPower,intelligence:this.input.developerTest.intelligence,...(this.input.developerTest.experiment?{experiment:this.input.developerTest.experiment}:{})}}:{}),...(this.animation?{animation:structuredClone(this.animation)}:{}),...(this.deadline!==undefined?{turnDeadlineMs:this.deadline}:{})};
  }
  private apply(actor:PlayerId,action:Action,now=Date.now()){
    const before=this.state,trace:BattleVisualEvent[]=[];
    this.state=applyAction(before,actor,action,{instanceId:opaqueCardId,visualEvent:e=>{if(trace.length<96)trace.push(e);}});
    this.animation=describeAcceptedAction(before,this.state,actor,action,trace);
    this.updateClock(now);
  }
  private updateClock(now:number){
    const limit=turnTimeLimitSeconds(this.state);
    if(limit===undefined){this.deadline=undefined;this.timedTurn=undefined;this.limit=undefined;return;}
    if(this.deadline===undefined||this.timedTurn!==this.state.turn){this.timedTurn=this.state.turn;this.deadline=now+limit*1000;}
    else if(this.limit!==undefined&&limit<this.limit)this.deadline=Math.min(this.deadline,now+limit*1000);
    this.limit=limit;
  }
  turnDeadline(){return this.deadline;}
  expireTurn(now=Date.now()):boolean{
    if(this.state.phase!=='playing'||this.deadline===undefined||now<this.deadline)return false;
    const actor=this.state.activePlayer;
    if(this.state.pendingChoice?.owner===actor&&this.state.pendingChoice.cards.length)this.apply(actor,{type:'chooseDeckCard',instanceId:this.state.pendingChoice.cards[0].instanceId},now);
    if(this.state.phase==='playing'&&this.state.activePlayer===actor)this.apply(actor,{type:'endTurn'},now);
    return true;
  }
  act(revision:number,action:Action):RoomView{
    if(revision!==this.state.revision)throw new RuleError('오래된 게임 화면입니다.');
    if(this.deadline!==undefined&&Date.now()>=this.deadline)throw new RuleError('턴 시간이 만료되었습니다.');
    this.apply(0,action);return this.view();
  }
  botReady():boolean{
    const s=this.state;
    return s.phase==='mulligan'&&s.players[0].mulliganDone&&!s.players[1].mulliganDone||s.phase==='playing'&&s.activePlayer===1;
  }
  botDelay():number{return this.input.animationSpeed==='instant'?35:this.animation?scaledBattleTiming(this.animation,this.input.animationSpeed).duration+(this.input.animationSpeed==='fast'?90:170):350;}
  botStep():boolean{
    if(this.expireTurn())return true;
    if(!this.botReady())return false;
    const s=this.state;
    if(this.botTurn!==s.turn){this.botTurn=s.turn;this.botActions=0;}
    const difficulty=this.input.developerTest?.experiment==='mixture-v1'?experimentalPolicy(this.input.difficulty,this.input.seed,1,s.turn):this.input.difficulty;
    const budget=deviceBudget(difficulty,this.input.deviceMode,this.input.device);
    const actions=this.botActions>=40&&s.phase==='playing'&&!s.pendingChoice?[{type:'endTurn'} as const]:rankBotActions(getPlayerView(s,1),s.catalog,1,difficulty,{...budget,weights:this.input.weights});
    if(this.expireTurn())return true;
    for(const action of actions){
      try{this.apply(1,action);this.botActions++;return true;}catch(e){if(!(e instanceof RuleError))throw e;}
    }
    throw Error('AI could not make a valid move.');
  }
}
export type LocalRequest={type:'start';input:LocalDuelInput;replaceSave?:LocalSaveSummary|null;ranked?:boolean;developerRank?:number;developerExperiment?:boolean}|{type:'act';requestId:number;revision:number;action:Action}|{type:'inspectSlot';catalogHash:string;catalog:Catalog}|{type:'inspectSave';catalogHash:string;catalog?:Catalog;settleAbandoned?:boolean}|{type:'resume';catalog:Catalog;catalogHash:string;device?:DeviceInfo;expectedCode?:string}|{type:'pause'|'retrySave'|'forfeit';requestId:number}|{type:'forfeitSaved';requestId:number;catalog:Catalog;catalogHash:string;expected:LocalSaveSummary}|{type:'discard';catalogHash:string;requestId:number;expected?:LocalSaveSummary}|{type:'rematch';code:string;seed:number;requestId:number}|{type:'exportGrowth';catalog:Catalog}|{type:'restoreGrowth';catalog:Catalog;backup:unknown};
export type LocalResponse=({type:'view';view:RoomView;requestId?:number;save?:LocalSaveSummary|null;saveAvailable?:boolean;resumed?:boolean}|{type:'slotInfo';overview:LocalSlotOverview}|{type:'saveInfo';save:LocalSaveSummary|null;available:boolean;otherActiveRanked?:boolean}|{type:'paused'|'forfeited';requestId:number;save:LocalSaveSummary}|{type:'discarded';requestId:number;save:LocalSaveSummary|null;available:boolean}|{type:'error';error:string;requestId?:number;save?:LocalSaveSummary|null;saveAvailable?:boolean}|{type:'growthBackup';backup:import('./offline-growth.ts').OfflineGrowthBackup}|{type:'growthRestored'})&{profile?:AccountProfile;saveRetryable?:boolean};
