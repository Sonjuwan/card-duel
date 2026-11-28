import {basicDeck} from '../../packages/basic-decks.ts';
import {collectionBotDeck} from '../../packages/collection-bot-deck.ts';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { applyAction, createGame, getPlayerView, RuleError, validateDeck, HERO_CLASSES, strategicDeck, DECK_STYLES, rankBotActions, isBotDifficulty, turnTimeLimitSeconds } from '../../packages/engine/src/index.ts';
import {snapshotCatalog,snapshotBattleCatalog} from '../../packages/engine/src/catalog-snapshot.ts';
import type { Action,BattleVisualEvent, BotWeights, Catalog, Deck, GameState, HeroClass, PlayerId, RuntimeOptions, BotDifficulty,DeckStyle } from '../../packages/engine/src/index.ts';
import type { RoomView, Session,FailureCode } from '../../packages/protocol.ts';
import { battleAnimationTiming } from '../../packages/protocol.ts';
import type { BattleAnimation } from '../../packages/protocol.ts';
import { describeAcceptedAction } from './battle-animation.ts';
import { aiCatalogHash,readGameChampion } from './ai-profile-store.ts';
import type {AccountActiveRoom,AccountRole,AccountView,AccountProfile,GrowthView,MatchAward,RankInfo,RankedRewardSummary} from '../../packages/account-protocol.ts';
import {ownedDeck,rankInfo,rankedBotDeck,syncOwned} from '../../packages/progression.ts';
import type {BotJob} from './bot-executor.ts';
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const runtime:RuntimeOptions={random:()=>randomInt(0,4294967296)/4294967296,instanceId:()=>randomUUID()};
type Member={token:string;socketId:string|null;deck:Deck;abandoned?:boolean;disconnectedAt?:number;accountId?:string};
type RankedInfo={accountId:string;matchId:string;rank:number;deckPower:number;intelligence:number;reward:'pending'|'saved'|'notEligible';rewardDetails?:RankedRewardSummary};
type Room={code:string;members:[Member,Member?];state:GameState|null;lastActive:number;animation?:BattleAnimation;timedTurn?:number;turnDeadlineMs?:number;limitSeconds?:number;pausedClockMs?:number;bot?:{turn:number;actions:number;difficulty:BotDifficulty;weights?:BotWeights;generation:number;style:DeckStyle};ranked?:RankedInfo;developerTest?:{rank:number;deckPower:number;intelligence:number};ownedPvp?:boolean;pvpMatch?:{matchId:string;savedAccounts:string[]};matchmakingRank?:number};
type RankedResult={accountId:string;code:string;award:MatchAward};
export const resultKey=(result:RankedResult)=>`${result.accountId}:${result.award.matchId}`;
type SavedMember=Omit<Member,'socketId'>;
type SavedRoom=Omit<Room,'members'|'state'|'turnDeadlineMs'>&{members:[SavedMember,SavedMember?];state:Omit<GameState,'catalog'>|null};
export type AccountRoomSnapshot={schema:1;code:string;catalogHash:string;room:SavedRoom|null;pending:RankedResult[]};
export class RoomError extends RuleError{readonly code:FailureCode;constructor(message:string,code:FailureCode){super(message);this.code=code;}}
type Expiration={socketId:string;code:string;reason:string};
export interface SweepResult{changed:string[];expired:Expiration[];removed:string[]}
export interface RoomOptions{clock?:()=>number;reconnectGraceMs?:number;waitingTtlMs?:number;finishedTtlMs?:number;maxRooms?:number;accountResumeMs?:number}
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new RuleError(message);}
function normalize(code:unknown){assert(typeof code==='string'&&code.trim().length===6,'방 코드는 6자리입니다.');return code.trim().toUpperCase();}
function object(x:unknown):x is Record<string,unknown>{return typeof x==='object'&&x!==null&&!Array.isArray(x);}
function token(){return randomBytes(32).toString('hex');}
const storedInteger=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
const storedId=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
const storedSeat=(value:unknown)=>value===0||value===1;
function storedAssert(condition:unknown,section:string):asserts condition{if(!condition)throw Error('Invalid stored room: '+section);}
/** Check the durable format before it can become an authoritative live room.
 * Historical, catalog-incompatible rooms are handled before this check. */
function validateSavedRoom(saved:SavedRoom,catalog:Catalog){
  storedAssert(object(saved)&&Array.isArray(saved.members)&&saved.members.length>=1&&saved.members.length<=2&&storedInteger(saved.lastActive),'header');
  const first=saved.members[0],second=saved.members[1];
  storedAssert(!!first&&storedId(first.accountId),'owner');
  for(const member of saved.members){if(!member)continue;storedAssert(object(member)&&typeof member.token==='string'&&/^[0-9a-f]{64}$/.test(member.token)&&(member.accountId===undefined||storedId(member.accountId))&&(member.abandoned===undefined||typeof member.abandoned==='boolean'),'member');validateDeck(member.deck,catalog);}
  storedAssert(new Set(saved.members.filter(Boolean).map(member=>member!.token)).size===saved.members.filter(Boolean).length,'member token');
  const ranked=saved.ranked,developer=saved.developerTest,pvp=saved.ownedPvp===true;
  storedAssert(Number(!!ranked)+Number(!!developer)+Number(pvp)===1,'mode');
  const tier=(value:RankInfo|Pick<RankInfo,'rank'|'deckPower'|'intelligence'>)=>object(value)&&storedInteger(value.rank,1,25)&&storedInteger(value.deckPower,1,25)&&storedInteger(value.intelligence,1,25);
  if(ranked)storedAssert(tier(ranked)&&ranked.accountId===first.accountId&&storedId(ranked.matchId)&&['pending','saved','notEligible'].includes(ranked.reward),'ranked metadata');
  if(developer)storedAssert(tier(developer),'developer metadata');
  if(pvp){
    storedAssert(!saved.bot&&(!saved.state?!second:!!second&&storedId(second.accountId)&&second.accountId!==first.accountId),'pvp seats');
    if(saved.pvpMatch){const match=saved.pvpMatch;storedAssert(!!saved.state&&storedId(match.matchId)&&Array.isArray(match.savedAccounts)&&new Set(match.savedAccounts).size===match.savedAccounts.length&&match.savedAccounts.every(id=>id===first.accountId||id===second?.accountId),'pvp metadata');}
    if(saved.matchmakingRank!==undefined)storedAssert(storedInteger(saved.matchmakingRank,1,25),'matchmaking rank');
  }else{
    const bot=saved.bot;
    storedAssert(!!saved.state&&!!second&&second.accountId===undefined&&!!bot&&isBotDifficulty(bot.difficulty)&&DECK_STYLES.includes(bot.style)&&storedInteger(bot.turn)&&storedInteger(bot.actions)&&storedInteger(bot.generation)&&!saved.pvpMatch,'AI metadata');
  }
  for(const value of [saved.timedTurn,saved.limitSeconds,saved.pausedClockMs])if(value!==undefined)storedAssert(storedInteger(value),'turn clock');
  const state=saved.state;if(state===null)return;
  storedAssert(object(state)&&['mulligan','playing','finished'].includes(state.phase)&&storedSeat(state.firstPlayer)&&storedSeat(state.activePlayer)&&storedInteger(state.turn)&&storedInteger(state.rng,0,0xffffffff)&&storedInteger(state.nextId)&&storedInteger(state.revision)&&(state.nextEntryOrder===undefined||storedInteger(state.nextEntryOrder))&&(state.winner===null||storedSeat(state.winner))&&(state.phase==='finished'?['health','fatigue','concede','turnLimit'].includes(state.reason??''):state.reason===null&&state.winner===null)&&Array.isArray(state.players)&&state.players.length===2&&Array.isArray(state.history),'battle state');
  const instance=(card:unknown)=>object(card)&&storedId(card.instanceId)&&storedId(card.cardId)&&Object.hasOwn(catalog,card.cardId);
  for(const [seat,player]of state.players.entries()){
    storedAssert(object(player)&&player.heroClass===saved.members[seat]?.deck.heroClass&&typeof player.mulliganDone==='boolean'&&typeof player.heroPowerUsed==='boolean','battle player');
    for(const key of ['health','mana','maxMana','armor','heroAttack','heroAttacksRemaining','pendingOverload','lockedMana','cardsPlayedThisTurn','fatigue'] as const)storedAssert(storedInteger(player[key],Number.MIN_SAFE_INTEGER),'battle counters');
    for(const zone of [player.deck,player.hand,player.board,player.secrets])storedAssert(Array.isArray(zone)&&zone.every(instance),'battle card zone');
    storedAssert(player.board.every(card=>catalog[card.cardId]?.kind==='minion')&&player.secrets.every(card=>catalog[card.cardId]?.kind==='secret'),'battle zone kind');
    if(player.nextTurnCards!==undefined)storedAssert(Array.isArray(player.nextTurnCards)&&player.nextTurnCards.every(id=>storedId(id)&&Object.hasOwn(catalog,id)),'next turn cards');
    for(const minion of player.board)storedAssert(storedInteger(minion.attack,Number.MIN_SAFE_INTEGER)&&storedInteger(minion.health,Number.MIN_SAFE_INTEGER)&&storedInteger(minion.maxHealth)&&storedInteger(minion.attacksRemaining),'minion counters');
    storedAssert(player.weapon===null||object(player.weapon)&&storedInteger(player.weapon.attack,Number.MIN_SAFE_INTEGER)&&storedInteger(player.weapon.durability)&&(player.weapon.cardId===undefined||storedId(player.weapon.cardId)&&Object.hasOwn(catalog,player.weapon.cardId)),'weapon');
  }
  storedAssert(state.history.every(event=>object(event)&&storedInteger(event.turn)&&storedSeat(event.player)&&typeof event.message==='string'),'battle history');
  if(state.pendingChoice!==undefined)storedAssert(object(state.pendingChoice)&&storedSeat(state.pendingChoice.owner)&&Array.isArray(state.pendingChoice.cards)&&state.pendingChoice.cards.every(instance),'pending choice');
}
export class RoomService {
  private rooms=new Map<string,Room>();
  private sockets=new Map<string,{code:string;seat:PlayerId}>();
  private tickets=new Map<string,{session:Session;expires:number}>();
  private replacements:Expiration[]=[];
  private rankedResults=new Map<string,RankedResult>();
  readonly catalog:Catalog;
  private readonly clock:()=>number;private readonly grace:number;private readonly waitTtl:number;private readonly finishTtl:number;private readonly maxRooms:number;private readonly accountResumeMs:number;
  constructor(catalog:Catalog,options:RoomOptions={}){this.catalog=snapshotCatalog(catalog);this.clock=options.clock??Date.now;this.grace=options.reconnectGraceMs??5*60*1000;this.waitTtl=options.waitingTtlMs??30*60*1000;this.finishTtl=options.finishedTtlMs??30*60*1000;this.maxRooms=options.maxRooms??200;this.accountResumeMs=options.accountResumeMs??24*60*60*1000;}
  private humans(r:Room){return r.members.filter((m,i):m is Member=>!!m&&(i===0||!r.bot));}
  private disconnected(r:Room){return this.humans(r).some(m=>!m.socketId&&!m.abandoned);}
  private absenceGrace(r:Room){return r.ranked&&r.state?.phase!=='finished'?this.accountResumeMs:r.ownedPvp&&r.state?.phase!=='finished'?this.waitTtl:this.grace;}
  private cleanup(now=this.clock()){
    for(const [ticket,t] of this.tickets)if(now>=t.expires||!this.rooms.has(t.session.code))this.tickets.delete(ticket);
    for(const [code,r] of this.rooms)if(now-r.lastActive>=this.absenceGrace(r)&&this.humans(r).every(m=>!m.socketId))this.rooms.delete(code);
  }
  private remove(r:Room,reason:string,result:SweepResult){for(const m of this.humans(r))if(m.socketId){this.sockets.delete(m.socketId);result.expired.push({socketId:m.socketId,code:r.code,reason});}this.rooms.delete(r.code);result.removed.push(r.code);}
  /** Disconnects pause live combat. The remaining timed-turn allowance is
   * restored on reconnect; a single absent human eventually forfeits. */
  sweep(now=this.clock()):SweepResult{
    const result:SweepResult={changed:[],expired:[],removed:[]};
    for(const r of this.rooms.values()){
      const humans=this.humans(r),present=humans.filter(m=>m.socketId).length;
      if(!present&&now-r.lastActive>=this.absenceGrace(r)){this.remove(r,'재접속 유효 시간이 만료되었습니다.',result);continue;}
      if(!r.state&&now-r.lastActive>=this.waitTtl){this.remove(r,'친구 대기 시간이 만료되었습니다.',result);continue;}
      if(r.state?.phase==='finished'&&now-r.lastActive>=this.finishTtl){this.remove(r,'종료된 방의 보관 시간이 만료되었습니다.',result);continue;}
      if(!r.bot&&r.state&&r.state.phase!=='finished'&&humans.length===2&&present===1){const seat=r.members.findIndex(m=>m&&!m.socketId&&!m.abandoned&&m.disconnectedAt!==undefined&&now-m.disconnectedAt>=this.grace);if(seat===0||seat===1){this.applyRoomAction(r,seat,{type:'concede'},now);r.members[seat]!.abandoned=true;r.members[seat]!.token=token();r.lastActive=now;result.changed.push(r.code);}}
    }
    this.cleanup(now);return result;
  }
  takeReplacements(){return this.replacements.splice(0);}
  /** A client's secret request ticket recovers the session even when the
   * room-create/join acknowledgement was lost before a disconnect. */
  withTicket(socketId:string,ticket:unknown,create:()=>Session,accountId?:string,accountRole?:AccountRole):Session{
    if(ticket===undefined)return create();
    assert(typeof ticket==='string'&&/^[0-9a-f]{64}$/.test(ticket),'잘못된 방 요청 번호입니다.');this.cleanup();
    if(this.tickets.has(ticket))return this.recover(socketId,{ticket},accountId,accountRole);
    const session=create();this.tickets.set(ticket,{session,expires:this.clock()+this.grace});return session;
  }
  recover(socketId:string,input:unknown,accountId?:string,accountRole?:AccountRole):Session{
    this.cleanup();if(!object(input)||typeof input.ticket!=='string'||!/^[0-9a-f]{64}$/.test(input.ticket))throw new RoomError('잘못된 방 요청 번호입니다.','ticketExpired');
    const saved=this.tickets.get(input.ticket);if(!saved)throw new RoomError('복구할 방 요청이 없거나 만료되었습니다.','ticketExpired');
    return this.resume(socketId,saved.session,accountId,accountRole);
  }
  resumeNeedsAccount(input:unknown,ticket=false){
    if(!object(input))return false;const code=ticket&&typeof input.ticket==='string'?this.tickets.get(input.ticket)?.session.code:typeof input.code==='string'?input.code.trim().toUpperCase():undefined;
    return !!(code&&this.rooms.get(code)?.members.some(m=>m?.accountId));
  }
  private ensureFree(socketId:string){assert(!this.sockets.has(socketId),'이미 다른 방에 참가 중입니다.');}
  private deck(input:unknown):Deck{validateDeck(input as Deck,this.catalog);const deck=input as Deck;return{heroClass:deck.heroClass,cards:[...deck.cards]};}
  private get(code:string):Room{const r=this.rooms.get(code);if(!r)throw new RoomError('존재하지 않거나 만료된 방입니다.','roomExpired');return r;}
  private bind(r:Room,seat:PlayerId,socketId:string):Session{
    const m=r.members[seat];assert(m,'존재하지 않는 플레이어입니다.');
    if(m.socketId&&m.socketId!==socketId){this.sockets.delete(m.socketId);this.replacements.push({socketId:m.socketId,code:r.code,reason:'다른 연결에서 이 대전을 복원했습니다.'});}
    m.socketId=socketId;delete m.disconnectedAt;r.lastActive=this.clock();this.sockets.set(socketId,{code:r.code,seat});this.updateTurnClock(r);return{code:r.code,seat,token:m.token};
  }
  create(socketId:string,deck:unknown):Session{
    this.cleanup();this.ensureFree(socketId);const d=this.deck(deck);assert(this.rooms.size<this.maxRooms,'방 생성 한도에 도달했습니다.');
    let code:string;do{code=Array.from({length:6},()=>ALPHABET[randomInt(ALPHABET.length)]).join('');}while(this.rooms.has(code)||[...this.rankedResults.values()].some(result=>result.code===code));
    const r:Room={code,members:[{token:token(),socketId:null,deck:d}],state:null,lastActive:this.clock()};this.rooms.set(code,r);return this.bind(r,0,socketId);
  }
  createBot(socketId:string,input:unknown,collection?:{growth:GrowthView;profile:AccountProfile}|'basic'):Session{
    this.ensureFree(socketId);assert(object(input)&&HERO_CLASSES.includes(input.heroClass as HeroClass),'잘못된 AI 직업입니다.');
    const difficulty=input.difficulty===undefined?3:input.difficulty;
    assert(isBotDifficulty(difficulty),'AI 난이도는 1~25 사이 정수여야 합니다.');
    const style=input.style===undefined?(difficulty>=16?'legendary':'practice'):input.style;
    assert(DECK_STYLES.includes(style as DeckStyle),'잘못된 AI 덱 유형입니다.');
    assert(input.firstPlayer===undefined||input.firstPlayer===0||input.firstPlayer===1,'잘못된 선후공 설정입니다.');
    assert(input.deckSeed===undefined||typeof input.deckSeed==='number'&&Number.isSafeInteger(input.deckSeed)&&input.deckSeed>=0&&input.deckSeed<=0xffffffff,'잘못된 AI 덱 시드입니다.');
    const d=this.deck(input.deck),hero=input.heroClass as HeroClass;
    const b=collection==='basic'?basicDeck(this.catalog,hero):collection
      ?collectionBotDeck(this.catalog,collection.growth,hero,collection.profile)
      :strategicDeck(this.catalog,hero,style as DeckStyle,input.deckSeed as number|undefined??randomInt(0,4294967296));
    const champion=readGameChampion(aiCatalogHash(this.catalog));
    const state=createGame(this.catalog,[d,b],{seed:randomInt(0,4294967296),firstPlayer:input.firstPlayer as PlayerId|undefined,runtime});
    const session=this.create(socketId,d),r=this.get(session.code);
    r.members[1]={token:token(),socketId:null,deck:b};r.state=state;r.bot={turn:0,actions:0,difficulty,weights:champion?.weights,generation:champion?.promotions??0,style:collection==='basic'?'starter':collection?'practice':style as DeckStyle};return session;
  }
  createRanked(socketId:string,input:unknown,account:AccountView,growth:GrowthView):Session{
    this.cleanup();this.ensureFree(socketId);assert(object(input),'잘못된 랭크 요청입니다.');
    this.ensureAccountFree(account.id);
    assert(![...this.rankedResults.values()].some(r=>r.accountId===account.id),'이전 랭크 경기 결과 저장 중입니다.');
    const profile=syncOwned(account.profile,growth),tier=rankInfo(profile.rank,growth.ranks),deck=this.deck(input.deck);
    try{ownedDeck(deck,this.catalog,profile);}catch(error){throw new RuleError(error instanceof Error?error.message:'잘못된 덱입니다.');}
    const session=this.createTierBot(socketId,deck,tier,growth,profile),r=this.get(session.code);
    r.members[0].accountId=account.id;r.ranked={accountId:account.id,matchId:randomUUID(),rank:tier.rank,deckPower:tier.deckPower,intelligence:tier.intelligence,reward:'pending'};return session;
  }
  createDeveloperTest(socketId:string,input:unknown,account:AccountView,growth:GrowthView):Session{
    this.cleanup();this.ensureFree(socketId);assert(account.role==='developer','개발자 권한이 필요합니다.');this.ensureAccountFree(account.id);
    assert(object(input)&&typeof input.rank==='number'&&Number.isInteger(input.rank)&&input.rank>=1&&input.rank<=25,'테스트 랭크는 1~25입니다.');
    const tier=rankInfo(input.rank,growth.ranks),deck=this.deck(input.deck),session=this.createTierBot(socketId,deck,tier,growth),r=this.get(session.code);
    r.members[0].accountId=account.id;r.developerTest={rank:tier.rank,deckPower:tier.deckPower,intelligence:tier.intelligence};return session;
  }
  private createTierBot(socketId:string,deck:Deck,tier:RankInfo,growth:GrowthView,profile?:AccountProfile):Session{
    const opponent=HERO_CLASSES[randomInt(HERO_CLASSES.length)],botDeck=profile?collectionBotDeck(this.catalog,growth,opponent,profile):rankedBotDeck(this.catalog,growth,opponent,tier.deckPower,randomInt(0,4294967296));
    const champion=readGameChampion(aiCatalogHash(this.catalog)),state=createGame(this.catalog,[deck,botDeck],{seed:randomInt(0,4294967296),runtime});
    const session=this.create(socketId,deck),r=this.get(session.code);
    r.members[1]={token:token(),socketId:null,deck:botDeck};r.state=state;r.bot={turn:0,actions:0,difficulty:tier.intelligence as BotDifficulty,weights:champion?.weights,generation:champion?.promotions??0,style:tier.deckPower<6?'starter':tier.deckPower<13?'practice':tier.deckPower<19?'synergy':'legendary'};
    return session;
  }
  private ensureAccountFree(accountId:string){assert(![...this.rooms.values()].some(r=>r.state?.phase!=='finished'&&r.members.some(m=>m?.accountId===accountId&&!m.abandoned)),'이미 이 계정에서 대전 중입니다.');}
  private accountDeck(input:unknown,account:AccountView,growth:GrowthView){
    const deck=this.deck(input);try{ownedDeck(deck,this.catalog,syncOwned(account.profile,growth));}catch(error){throw new RuleError(error instanceof Error?error.message:'잘못된 덱입니다.');}return deck;
  }
  createOwnedPvp(socketId:string,input:unknown,account:AccountView,growth:GrowthView):Session{
    this.cleanup();this.ensureFree(socketId);this.ensureAccountFree(account.id);assert(object(input),'잘못된 계정 대전 요청입니다.');
    const deck=this.accountDeck(input.deck,account,growth),session=this.create(socketId,deck),room=this.get(session.code);room.ownedPvp=true;room.members[0].accountId=account.id;return session;
  }
  joinOwnedPvp(socketId:string,input:unknown,account:AccountView,growth:GrowthView):Session{
    this.cleanup();this.ensureFree(socketId);this.ensureAccountFree(account.id);assert(object(input),'잘못된 계정 대전 요청입니다.');
    const room=this.get(normalize(input.code));assert(room.ownedPvp,'보유 카드 계정 대전 방이 아닙니다.');assert(room.members[0].accountId!==account.id,'동일 계정끼리 대전할 수 없습니다.');
    const deck=this.accountDeck(input.deck,account,growth);return this.joinInternal(socketId,{code:room.code,deck},account.id);
  }
  matchOwnedPvp(socketId:string,input:unknown,account:AccountView,growth:GrowthView):Session{
    this.cleanup();this.ensureFree(socketId);this.ensureAccountFree(account.id);assert(object(input),'잘못된 계정 대전 요청입니다.');
    const deck=this.accountDeck(input.deck,account,growth);
    const waiting=[...this.rooms.values()].filter(r=>r.ownedPvp&&r.matchmakingRank!==undefined&&!r.state&&!r.members[1]&&r.members[0].socketId&&r.members[0].accountId!==account.id).sort((a,b)=>Math.abs(a.matchmakingRank!-account.profile.rank)-Math.abs(b.matchmakingRank!-account.profile.rank)||a.lastActive-b.lastActive)[0];
    if(waiting)return this.joinInternal(socketId,{code:waiting.code,deck},account.id);
    const session=this.createOwnedPvp(socketId,{deck},account,growth);this.get(session.code).matchmakingRank=account.profile.rank;return session;
  }
  resumeAccount(socketId:string,accountId:string,accountRole?:AccountRole):Session{
    this.cleanup();const found=[...this.rooms.values()].find(r=>r.state?.phase!=='finished'&&r.members.some(m=>m?.accountId===accountId&&!m.abandoned));
    if(!found)throw new RoomError('이 계정에 이어할 진행 중 대전이 없습니다.','roomExpired');
    assert(!found.developerTest||accountRole==='developer','개발자 권한이 필요합니다.');const seat=found.members.findIndex(m=>m?.accountId===accountId&&!m.abandoned) as PlayerId;
    const old=this.sockets.get(socketId);assert(!old||(old.code===found.code&&old.seat===seat),'이미 다른 방에 참가 중입니다.');
    // Rotate the resume secret on device transfer; old device cannot silently retake it.
    found.members[seat]!.token=token();return this.bind(found,seat,socketId);
  }
  pendingRankedResults(){return [...this.rankedResults.values()];}
  /** Server-only checkpoint. Do not expose state, private hand/deck or tokens to HTTP clients. */
  accountSnapshot(code:string,catalogHash:string):AccountRoomSnapshot|null{
    const r=this.rooms.get(code),pending=this.pendingRankedResults().filter(result=>result.code===code);
    if(!r?.members.some(m=>m?.accountId)&&!pending.length)return null;
    let room:SavedRoom|null=null;
    if(r){
      const {state,members,turnDeadlineMs,...rest}=r;
      const savedMembers=members.map(m=>{if(!m)return undefined;const {socketId,...saved}=m;return saved;}) as [SavedMember,SavedMember?];
      let savedState:SavedRoom['state']=null;if(state){const {catalog,...data}=state;savedState=data;}
      room={...rest,members:savedMembers,state:savedState,...(turnDeadlineMs===undefined?{}:{pausedClockMs:Math.max(0,turnDeadlineMs-this.clock())})};
    }
    return structuredClone({schema:1,code,catalogHash,room,pending});
  }
  accountSnapshotCodes(){return [...new Set([...this.rooms.values()].filter(r=>r.members.some(m=>m?.accountId)).map(r=>r.code).concat(this.pendingRankedResults().map(r=>r.code)))];}
  accountRoomEntries(code:string):Map<string,Omit<AccountActiveRoom,'resumeAllowed'>>{
    const entries=new Map<string,Omit<AccountActiveRoom,'resumeAllowed'>>(),room=this.rooms.get(code);
    if(!room||room.state?.phase==='finished')return entries;
    const mode=room.ranked?'ranked':room.developerTest?'developer-test':room.ownedPvp?'pvp':null;
    if(!mode)return entries;
    const rank=room.ranked?.rank??room.developerTest?.rank;
    for(const member of room.members)if(member?.accountId&&!member.abandoned)entries.set(member.accountId,{mode,status:room.state?'playing':'waiting',connected:!!member.socketId,...(rank===undefined?{}:{rank})});
    return entries;
  }
  metrics(){const result={total:this.rooms.size,playing:0,waiting:0,finished:0,account:0,accountPlaying:0,accountWaiting:0,ai:0};for(const r of this.rooms.values()){const account=r.members.some(m=>m?.accountId);if(!r.state){result.waiting++;if(account)result.accountWaiting++;}else if(r.state.phase==='finished')result.finished++;else{result.playing++;if(account)result.accountPlaying++;}if(account)result.account++;if(r.bot)result.ai++;}return result;}
  socketRoomCode(socketId:string){return this.sockets.get(socketId)?.code;}
  accountMembership(socketId:string){
    const seat=this.sockets.get(socketId),room=seat&&this.rooms.get(seat.code),member=room&&seat?room.members[seat.seat]:undefined;
    return room&&member?.accountId?{code:room.code,accountId:member.accountId,developerOnly:!!room.developerTest}:null;
  }
  restoreAccountSnapshot(snapshot:AccountRoomSnapshot,catalogHash:string){
    if(!object(snapshot)||snapshot.schema!==1||typeof snapshot.code!=='string'||!/^[A-Z2-9]{6}$/.test(snapshot.code)||typeof snapshot.catalogHash!=='string'||!/^[a-f0-9]{64}$/.test(snapshot.catalogHash)||!Array.isArray(snapshot.pending)||snapshot.room!==null&&!object(snapshot.room))throw new Error('Invalid account room snapshot');
    const pending=new Map<string,RankedResult>();
    for(const result of snapshot.pending){
      const award=result?.award,mode=award?.mode??'ranked';
      if(!result||result.code!==snapshot.code||!storedId(result.accountId)||!award||!storedId(award.matchId)||!['pvp','ranked'].includes(mode)||!['win','loss','draw'].includes(award.outcome)||!HERO_CLASSES.includes(award.heroClass)||typeof award.eligible!=='boolean'||!Number.isInteger(award.rank)||(mode==='ranked'?award.rank<1||award.rank>25:award.rank!==0)||award.turns!==undefined&&!storedInteger(award.turns)||award.completedAt!==undefined&&!storedInteger(award.completedAt)||award.opponentClass!==undefined&&!HERO_CLASSES.includes(award.opponentClass))throw new Error('Invalid pending account result');
      const key=resultKey(result);if(this.rankedResults.has(key)||pending.has(key))throw new Error('Duplicate pending account result');pending.set(key,structuredClone(result));
    }
    const acceptPending=()=>{for(const [key,result]of pending)this.rankedResults.set(key,result);};
    const saved=snapshot.room;if(!saved||snapshot.catalogHash!==catalogHash){acceptPending();return false;}
    if(!Array.isArray(saved.members)||!saved.members[0]?.accountId||saved.code!==snapshot.code||!Number.isFinite(saved.lastActive))throw new Error('Invalid stored room');
    const now=this.clock();if(now-saved.lastActive>this.accountResumeMs){acceptPending();return false;}
    // Fresh games include the built-in hero-power minion definitions. A
    // checkpoint stores only dynamic state, so restore the same full catalog.
    const battleCatalog=snapshotBattleCatalog(this.catalog);
    validateSavedRoom(saved,battleCatalog);
    for(const result of pending.values()){
      const {award,accountId}=result,seat=saved.members.findIndex(member=>member?.accountId===accountId);
      const rank=saved.ranked,match=saved.pvpMatch,state=saved.state;
      storedAssert(state?.phase==='finished'&&storedSeat(seat)&&award.heroClass===saved.members[seat]?.deck.heroClass&&award.outcome===(state.winner===null?'draw':state.winner===seat?'win':'loss')&&(rank?award.mode!=='pvp'&&award.rank===rank.rank&&award.matchId===rank.matchId&&accountId===rank.accountId:!!match&&award.mode==='pvp'&&award.rank===0&&award.matchId===match.matchId),'pending result relationship');
    }
    const members=saved.members.map(m=>!m?undefined:{...m,socketId:null,disconnectedAt:now}) as [Member,Member?];
    const room:Room={...structuredClone({...saved,members,state:null}),state:saved.state?{...structuredClone(saved.state),catalog:battleCatalog}:null};
    if(this.rooms.has(room.code))throw new Error('Duplicate restored room');
    if(now-room.lastActive>=this.absenceGrace(room)||room.state?.phase==='finished'&&now-room.lastActive>=this.finishTtl){acceptPending();return false;}
    // A lower startup capacity must never silently discard a valid saved room.
    if(this.rooms.size>=this.maxRooms)throw new Error('저장 경기 수가 서버 한도를 초과했습니다. 기존 경기 보호를 위해 시작을 중단합니다.');
    if(room.state?.phase!=='finished'){
      const ids=room.members.filter(m=>m?.accountId&&!m.abandoned).map(m=>m!.accountId!);
      if(new Set(ids).size!==ids.length)throw new Error('Duplicate account in restored room');
      for(const id of ids)this.ensureAccountFree(id);
    }
    if(room.ownedPvp&&room.state&&room.state.phase!=='finished'&&!room.pvpMatch)room.pvpMatch={matchId:randomUUID(),savedAccounts:[]};
    acceptPending();this.rooms.set(room.code,room);this.captureRankedResult(room);return true;
  }
  confirmRankedResult(key:string,profile?:AccountProfile){const result=this.rankedResults.get(key);if(!result)return undefined;this.rankedResults.delete(key);const room=this.rooms.get(result.code),id=result.award.matchId;if(room?.ranked?.matchId===id){room.ranked.reward=result.award.eligible?'saved':'notEligible';const entry=profile?.recentMatches?.find(match=>match.matchId===id&&match.mode==='ranked');if(entry){const {xp,questAdvanced,questCompleted,questBonusXp,unlockedCards,rankAfter}=entry;room.ranked.rewardDetails={xp,questAdvanced,questCompleted,questBonusXp,unlockedCards,rankAfter};}}if(room?.pvpMatch?.matchId===id&&!room.pvpMatch.savedAccounts.includes(result.accountId))room.pvpMatch.savedAccounts.push(result.accountId);return result.code;}
  private captureRankedResult(r:Room){
    const state=r.state;if(state?.phase!=='finished')return;
    const add=(record:RankedResult)=>{const key=resultKey(record);if(!this.rankedResults.has(key))this.rankedResults.set(key,record);};
    const details={completedAt:this.clock(),turns:state.turn};
    if(r.pvpMatch){for(const seat of [0,1] as const){const accountId=r.members[seat]?.accountId;if(!accountId||r.pvpMatch.savedAccounts.includes(accountId))continue;const opponent=seat===0?1:0;add({accountId,code:r.code,award:{matchId:r.pvpMatch.matchId,mode:'pvp',rank:0,heroClass:r.members[seat]!.deck.heroClass,opponentClass:r.members[opponent]!.deck.heroClass,outcome:state.winner===null?'draw':state.winner===seat?'win':'loss',eligible:true,...details}});}return;}
    if(!r.ranked||r.ranked.reward!=='pending')return;
    // A quick intentional loss cannot farm XP. Normal victories count regardless of turn.
    const outcome=state.winner===0?'win':state.winner===1?'loss':'draw';
    const eligible=outcome==='win'||state.reason!=='concede'||state.turn>=6;
    add({accountId:r.ranked.accountId,code:r.code,award:{matchId:r.ranked.matchId,rank:r.ranked.rank,heroClass:r.members[0].deck.heroClass,opponentClass:r.members[1]?.deck.heroClass,outcome,eligible,...details}});
  }
  botReady(code:string):boolean{
    const r=this.rooms.get(code),s=r?.state;
    return !!(r?.bot&&r.members[0].socketId&&s&&(s.phase==='mulligan'&&s.players[0].mulliganDone&&!s.players[1].mulliganDone||s.phase==='playing'&&s.activePlayer===1));
  }
  botDelay(code:string):number {
    const animation=this.rooms.get(code)?.animation;
    return animation?battleAnimationTiming(animation).duration+170:350;
  }
  private applyRoomAction(r:Room,actor:PlayerId,action:unknown,now=this.clock()){
    const before=r.state!,events:BattleVisualEvent[]=[];
    const after=applyAction(before,actor,action,{...runtime,visualEvent:event=>{if(events.length<96)events.push(event);}});
    r.state=after;r.animation=describeAcceptedAction(before,after,actor,action,events);
    this.captureRankedResult(r);
    this.updateTurnClock(r,now);
  }
  private updateTurnClock(r:Room,now=this.clock()){
    const s=r.state,limit=s?turnTimeLimitSeconds(s):undefined;
    if(limit===undefined||!s){delete r.turnDeadlineMs;delete r.timedTurn;delete r.limitSeconds;delete r.pausedClockMs;return;}
    if(this.disconnected(r)){
      const remaining=r.timedTurn===s.turn?(r.pausedClockMs??(r.turnDeadlineMs===undefined?limit*1000:Math.max(0,r.turnDeadlineMs-now))):limit*1000;
      r.pausedClockMs=Math.min(remaining,limit*1000);r.timedTurn=s.turn;r.limitSeconds=limit;delete r.turnDeadlineMs;return;
    }
    if(r.pausedClockMs!==undefined&&r.timedTurn===s.turn){r.turnDeadlineMs=now+Math.min(r.pausedClockMs,limit*1000);delete r.pausedClockMs;r.limitSeconds=limit;return;}
    delete r.pausedClockMs;
    if(r.timedTurn!==s.turn||r.turnDeadlineMs===undefined){r.timedTurn=s.turn;r.turnDeadlineMs=now+limit*1000;}
    else if(r.limitSeconds!==undefined&&limit<r.limitSeconds)r.turnDeadlineMs=Math.min(r.turnDeadlineMs,now+limit*1000);
    r.limitSeconds=limit;
  }
  turnDeadline(code:string):number|undefined{return this.rooms.get(code)?.turnDeadlineMs;}
  expireTurn(code:string,now=this.clock()):boolean{
    const r=this.rooms.get(code),s=r?.state;
    if(!r||!s||s.phase!=='playing'||r.turnDeadlineMs===undefined||now<r.turnDeadlineMs)return false;
    const actor=s.activePlayer;
    if(s.pendingChoice?.owner===actor&&s.pendingChoice.cards.length)this.applyRoomAction(r,actor,{type:'chooseDeckCard',instanceId:s.pendingChoice.cards[0].instanceId},now);
    if(r.state?.phase==='playing'&&r.state.activePlayer===actor)this.applyRoomAction(r,actor,{type:'endTurn'},now);
    r.lastActive=now;return true;
  }
  stepBot(code:string):boolean{
    if(!this.botReady(code))return false;
    if(this.expireTurn(code))return true;
    const r=this.get(code),s=r.state!,b=r.bot!;
    if(b.turn!==s.turn){b.turn=s.turn;b.actions=0;}
    const actions=b.actions>=40&&s.phase==='playing'&&!s.pendingChoice?[{type:'endTurn'} as const]:rankBotActions(getPlayerView(s,1),s.catalog,1,b.difficulty,{weights:b.weights,deadlineMs:1500});
    if(this.expireTurn(code))return true;
    for(const action of actions){
      try{this.applyRoomAction(r,1,action);b.actions++;r.lastActive=this.clock();return true;}
      catch(e){if(!(e instanceof RuleError))throw e;}
    }
    throw new Error('AI could not perform an action');
  }
  /** Worker receives only the AI's projected view. Revalidate room identity,
   * readiness and revision after the await before applying a proposed action. */
  async stepBotAsync(code:string,run:(job:BotJob)=>Promise<Action[]>,canApply:()=>boolean=()=>true):Promise<boolean>{
    if(!this.botReady(code)||!canApply())return false;if(this.expireTurn(code))return true;
    const room=this.get(code),state=room.state!,bot=room.bot!;
    if(bot.turn!==state.turn){bot.turn=state.turn;bot.actions=0;}
    const actions:Action[]=bot.actions>=40&&state.phase==='playing'&&!state.pendingChoice?[{type:'endTurn'}]:await run({view:getPlayerView(state,1),difficulty:bot.difficulty,weights:bot.weights});
    if(!canApply()||this.rooms.get(code)!==room||!this.botReady(code)||room.state?.revision!==state.revision)return false;
    if(this.expireTurn(code))return true;
    for(const action of actions){try{this.applyRoomAction(room,1,action);bot.actions++;room.lastActive=this.clock();return true;}catch(error){if(!(error instanceof RuleError))throw error;}}
    throw new Error('AI could not perform an action');
  }
  join(socketId:string,input:unknown):Session{
    return this.joinInternal(socketId,input);
  }
  private joinInternal(socketId:string,input:unknown,accountId?:string):Session{
    this.cleanup();this.ensureFree(socketId);assert(object(input),'잘못된 방 참가 요청');const r=this.get(normalize(input.code));
    assert(!!r.ownedPvp===!!accountId,'보유 카드 계정 대전은 계정 전용 참가를 사용하세요.');
    assert(!r.members[1]&&!r.state,'이미 두 명이 참가한 방입니다.');const d=this.deck(input.deck);
    const state=createGame(this.catalog,[r.members[0].deck,d],{seed:randomInt(0,4294967296),runtime});
    r.members[1]={token:token(),socketId:null,deck:d,accountId};r.state=state;if(r.ownedPvp)r.pvpMatch={matchId:randomUUID(),savedAccounts:[]};return this.bind(r,1,socketId);
  }
  resume(socketId:string,input:unknown,accountId?:string,accountRole?:AccountRole):Session{
    this.cleanup();if(!object(input)||typeof input.token!=='string'||!/^[0-9a-f]{64}$/.test(input.token))throw new RoomError('잘못된 재접속 정보','sessionInvalid');const r=this.get(normalize(input.code));
    const seat=r.members.findIndex(m=>!m?.abandoned&&m?.token===input.token);if(!(seat===0||seat===1&&!r.bot))throw new RoomError('재접속 권한이 없습니다.','sessionInvalid');
    if(r.members[seat]?.accountId&&r.members[seat]?.accountId!==accountId)throw new RoomError('원래 계정으로 로그인해야 합니다.','sessionInvalid');
    if(r.developerTest&&accountRole!=='developer')throw new RoomError('개발자 권한이 필요합니다.','sessionInvalid');
    const old=this.sockets.get(socketId);assert(!old||(old.code===r.code&&old.seat===seat),'이미 다른 방에 참가 중입니다.');return this.bind(r,seat,socketId);
  }
  private membership(socketId:string){const ref=this.sockets.get(socketId);if(!ref)throw new RoomError('먼저 방에 참가하세요.','sessionInvalid');const r=this.get(ref.code);if(r.members[ref.seat]?.socketId!==socketId)throw new RoomError('유효하지 않은 세션','sessionInvalid');return{room:r,seat:ref.seat};}
  act(socketId:string,input:unknown):string{
    const {room:r,seat}=this.membership(socketId);assert(r.state,'상대방이 아직 참가하지 않았습니다.');
    if(!object(input)||!Number.isSafeInteger(input.revision)||input.revision!==r.state.revision)throw new RoomError('오래된 게임 화면입니다. 다시 시도하세요.','staleRevision');
    const concede=object(input.action)&&input.action.type==='concede';
    if(!concede&&this.disconnected(r))throw new RoomError('상대가 재접속할 때까지 대전을 일시 중지했습니다.','opponentDisconnected');
    assert(concede||r.turnDeadlineMs===undefined||r.turnDeadlineMs>this.clock(),'턴 시간이 만료되었습니다.');
    this.applyRoomAction(r,seat,input.action);r.lastActive=this.clock();return r.code;
  }
  view(socketId:string):RoomView{
    const {room:r,seat}=this.membership(socketId),opponent=r.members[seat===0?1:0],reconnect=!r.bot&&r.state&&r.state.phase!=='finished'&&!opponent?.socketId&&opponent?.disconnectedAt!==undefined?opponent.disconnectedAt+this.grace:undefined;return{code:r.code,seat,mode:r.bot?'bot':'human',botDifficulty:r.bot?.difficulty,botTrainingGeneration:r.bot?.generation,botEngine:r.bot?'server':undefined,botDeckStyle:r.bot?.style,status:!r.state?'waiting':r.state.phase==='finished'?'finished':'playing',opponentConnected:!!r.bot||!!opponent?.socketId,state:r.state?getPlayerView(r.state,seat):null,turnDeadlineMs:r.turnDeadlineMs,opponentReconnectDeadlineMs:reconnect,...(r.ranked?{ranked:{rank:r.ranked.rank,deckPower:r.ranked.deckPower,intelligence:r.ranked.intelligence,reward:r.ranked.reward,rewardDetails:r.ranked.rewardDetails}}:{}),...(r.developerTest?{developerTest:{...r.developerTest}}:{}),...(r.ownedPvp?{ownedPvp:true}:{}),...(r.pvpMatch&&r.state?.phase==='finished'?{pvpReward:r.pvpMatch.savedAccounts.includes(r.members[seat]?.accountId??'')?'saved':'pending'}:{}),...(r.animation?.revision===r.state?.revision&&r.animation?{animation:structuredClone(r.animation)}:{})};
  }
  socketsFor(code:string):string[]{return this.rooms.get(code)?.members.flatMap(m=>m?.socketId?[m.socketId]:[])??[];}
  disconnect(socketId:string):string|undefined{
    const ref=this.sockets.get(socketId);if(!ref)return;this.sockets.delete(socketId);const r=this.rooms.get(ref.code);if(!r)return;
    const m=r.members[ref.seat],now=this.clock();if(m?.socketId===socketId){m.socketId=null;m.disconnectedAt=now;}r.lastActive=now;this.updateTurnClock(r,now);return ref.code;
  }
  pauseAccount(socketId:string):string{
    const {room:r,seat}=this.membership(socketId);assert(!!r.ranked&&r.members[seat]?.accountId&&r.state?.phase!=='finished','진행 중인 계정 AI 대전만 저장하고 나갈 수 있습니다.');
    this.disconnect(socketId);return r.code;
  }
  leave(socketId:string):string{
    const {room:r,seat}=this.membership(socketId);
    if(r.bot){if(r.ranked&&r.state?.phase!=='finished')this.applyRoomAction(r,seat,{type:'concede'});this.sockets.delete(socketId);this.rooms.delete(r.code);return r.code;}
    if(!r.state){this.sockets.delete(socketId);this.rooms.delete(r.code);return r.code;}
    if(r.state.phase!=='finished')this.applyRoomAction(r,seat,{type:'concede'});this.updateTurnClock(r);
    this.disconnect(socketId);const m=r.members[seat]!;m.token=token();m.abandoned=true; // invalidate deliberately abandoned session
    if(r.members.every(m=>m?.abandoned))this.rooms.delete(r.code);
    return r.code;
  }
}
