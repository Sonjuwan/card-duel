import type { Card, CardInstance, Catalog, Deck, GameState, HeroClass, Minion, Player, PlayerId, PlayerView, PublicPlayer, SecretTrigger, Effect, Weapon, Target } from './types.ts';
import { RULES, HERO_CLASSES, TRIBES, RuleError, requireRule, record, integer, isClass, other, validPlayer, random, setRuntime, opaqueId, emitVisual,maxCardCopies } from './rules.ts';
import type { RuntimeOptions } from './rules.ts';
import { chooseTarget, effectiveTargetRule, hasKeyword, hero, lookupTarget, resolveEffects, TARGET_RULES, KEYWORDS, validateEffects, minionDamageResult } from './effects.ts';
import type { Character, EffectContext, EffectOps, DeathPlacement, DeathSlot } from './effects.ts';
import { getHeroPower, HERO_TOKENS } from './hero-powers.ts';
import { refreshAuras } from './auras.ts';
import { currentCost } from './costs.ts';
import { snapshotBattleCatalog } from './catalog-snapshot.ts';
import { spellRequirementReason, heroPowerReason } from './playability.ts';
import {unknownCardFields} from './card-schema.ts';
export { RULES, HERO_CLASSES, RuleError };
function shuffle<T>(s: GameState, items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}
export function createCatalog(data: unknown): Catalog {
  requireRule(Array.isArray(data), '카드 데이터는 배열이어야 합니다.');
  const catalog: Catalog = Object.create(null);
  for (const c of data) {
    requireRule(record(c), '잘못된 카드 데이터');
    try{
    const unknownFields=unknownCardFields(c);requireRule(!unknownFields.length,'지원하지 않는 카드 필드: '+unknownFields.join(', '));
    requireRule(typeof c.id === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(c.id) && !Object.hasOwn(catalog, c.id), '잘못된 카드 ID 또는 중복 ID');
    requireRule(typeof c.name === 'string' && c.name.trim().length > 0, '카드 이름이 필요합니다.');
    requireRule(integer(c.cost, 0, c.kind==='minion'&&c.discountBy!==undefined?30:10), '카드 비용이 올바르지 않습니다.');
    requireRule(['basic','common','rare','epic','legendary'].some(r => r === c.rarity), '지원하지 않는 희귀도');
    requireRule(c.class === 'neutral' || isClass(c.class), '지원하지 않는 직업');
    requireRule(typeof c.description === 'string' && (c.collectible===undefined||typeof c.collectible==='boolean'),'잘못된 카드 설명/수집 가능 여부');
    requireRule(c.targetRule===undefined||TARGET_RULES.some(t=>t===c.targetRule),'잘못된 대상 규칙');
    switch(c.kind){
      case 'minion':
        requireRule(integer(c.attack,0,100)&&integer(c.health,1,100),'하수인 능력치가 올바르지 않습니다.');
        requireRule(TRIBES.some(t=>t===c.tribe),'지원하지 않는 종족');
        requireRule(c.keywords===undefined||(Array.isArray(c.keywords)&&c.keywords.every(k=>KEYWORDS.some(x=>x===k))&&new Set(c.keywords).size===c.keywords.length),'지원하지 않는 키워드 또는 중복 키워드');
        requireRule(c.spellDamage===undefined||integer(c.spellDamage,0,10),'잘못된 주문 공격력');
        requireRule(c.enrageWindfury===undefined||typeof c.enrageWindfury==='boolean','잘못된 격노 질풍');
    requireRule(c.enrageWeaponAttack===undefined||integer(c.enrageWeaponAttack,1,20),'잘못된 격노 무기 공격력');
    for(const key of ['noAttack','chargeWithWeapon','untargetableBySpells'])requireRule(c[key]===undefined||typeof c[key]==='boolean','잘못된 하수인 지속 규칙');
    requireRule(c.enrageAttack===undefined||integer(c.enrageAttack,1,20),'잘못된 격노 공격력');
        requireRule(c.freezeOnCombatDamage===undefined||typeof c.freezeOnCombatDamage==='boolean','잘못된 전투 빙결 효과');
        requireRule(c.attackEqualsHealth===undefined||typeof c.attackEqualsHealth==='boolean','잘못된 공격력 및 생명력 연동 효과');
        requireRule(c.healingToDamage===undefined||typeof c.healingToDamage==='boolean','잘못된 치유 반전 효과');
        requireRule(c.spellAndPowerMultiplier===undefined||integer(c.spellAndPowerMultiplier,2,4),'잘못된 주문/영웅 능력 배율');
        const tribeAttack=c.attackPerOtherTribe;
        requireRule(tribeAttack===undefined||record(tribeAttack)&&TRIBES.some(t=>t===tribeAttack.tribe)&&integer(tribeAttack.amount,1,10),'잘못된 종족 공격력 지속 효과');
        requireRule(c.turnTimeLimitSeconds===undefined||integer(c.turnTimeLimitSeconds,5,120),'잘못된 턴 시간 제한');
        requireRule(c.chargeAuraTribe===undefined||TRIBES.some(t=>t===c.chargeAuraTribe),'잘못된 돌진 지속 효과 종족');
        requireRule(c.discountBy===undefined||['boardCount','otherHandCards','missingHeroHealth'].some(x=>x===c.discountBy),'잘못된 가변 비용');
        requireRule(c.discountByWeaponAttack===undefined||typeof c.discountByWeaponAttack==='boolean','잘못된 무기 비용 감소');
        requireRule(c.costAuras===undefined||(Array.isArray(c.costAuras)&&c.costAuras.length>0&&c.costAuras.length<=8&&c.costAuras.every(a=>record(a)&&['spell','minion','weapon','any'].some(k=>k===a.kind)&&(a.side==='friendly'||a.side==='both')&&integer(a.amount,-10,10)&&a.amount!==0&&(a.minimum===undefined||integer(a.minimum,0,10))&&(a.firstMinionOnly===undefined||(a.kind==='minion'&&typeof a.firstMinionOnly==='boolean'))&&(a.tribe===undefined||(a.kind==='minion'&&TRIBES.some(t=>t===a.tribe))))),'잘못된 비용 변화 지속 효과');
        requireRule(c.auras===undefined||(Array.isArray(c.auras)&&c.auras.length>0&&c.auras.length<=8&&c.auras.every(a=>record(a)&&['otherFriendlyMinions','adjacentFriendlyMinions','allOtherMinions'].some(t=>t===a.target)&&integer(a.attack,0,20)&&integer(a.health,0,20)&&a.attack+a.health>0&&(a.tribe===undefined||TRIBES.some(t=>t===a.tribe)))),'잘못된 지속 강화 효과');
        requireRule(c.triggers===undefined||(Array.isArray(c.triggers)&&c.triggers.length>0&&c.triggers.length<=8&&c.triggers.every(a=>record(a)&&['friendlyMinionSummoned','friendlySpellCast','friendlySpellPlayed','anySpellPlayed','friendlyMinionDied','anyMinionDied','selfDamaged','anyMinionHealed','friendlyMinionDamaged','anyMinionDamaged','friendlyOverload','friendlyOverloadCardPlayed','anyCharacterHealed','anyMinionSummoned','friendlyCardPlayed','anySecretPlayed'].some(t=>t===a.event)&&(a.tribe===undefined||(!['friendlySpellCast','friendlySpellPlayed','anySpellPlayed','friendlyOverload','friendlyOverloadCardPlayed'].some(t=>t===a.event)&&TRIBES.some(t=>t===a.tribe)))&&Array.isArray(a.effects))),'잘못된 이벤트 발동 조건');
        requireRule(c.targetRule===undefined||c.battlecry!==undefined,'대상 규칙에는 전투의 함성이 필요합니다.');
        requireRule(c.description.trim()===''||c.keywords!==undefined||c.battlecry!==undefined||c.deathrattle!==undefined||c.startTurn!==undefined||c.endTurn!==undefined||c.endAnyTurn!==undefined||c.spellAndPowerMultiplier!==undefined||c.attackPerOtherTribe!==undefined||c.turnTimeLimitSeconds!==undefined||c.spellDamage!==undefined||c.enrageAttack!==undefined||c.enrageWindfury||c.enrageWeaponAttack!==undefined||c.noAttack||c.chargeWithWeapon||c.untargetableBySpells||c.freezeOnCombatDamage===true||c.attackEqualsHealth===true||c.healingToDamage===true||c.chargeAuraTribe!==undefined||c.costAuras!==undefined||c.discountByWeaponAttack===true||c.discountBy!==undefined||c.auras!==undefined||c.triggers!==undefined||c.choices!==undefined,'설명에 대응하는 효과가 필요합니다.');
        break;
      case 'spell':requireRule(Array.isArray(c.effects)||Array.isArray(c.choices),'주문 효과가 필요합니다.');break;
      case 'weapon':for(const key of ['windfury','immuneWhileAttacking','attackLossVsMinion'])requireRule(c[key]===undefined||typeof c[key]==='boolean','잘못된 무기 특수 규칙');requireRule(integer(c.attack,0,100)&&integer(c.durability,1,100)&&(c.targetRule===undefined||Array.isArray(c.battlecry))&&[c.battlecry,c.beforeAttack,c.secretRevealed,c.friendlySummon].every(v=>v===undefined||Array.isArray(v))&&(c.secretRevealedSide===undefined||Array.isArray(c.secretRevealed)&&['friendly','both'].some(side=>side===c.secretRevealedSide)),'잘못된 무기 수치 또는 효과');break;
      case 'secret':requireRule(['enemyAttackHero','enemyAttackAny','enemyMinionAttack','enemyAttackFriendlyMinion','enemyPlayMinion','enemyCastSpell','enemyTargetMinionSpell','friendlyMinionDied','friendlyHeroDamaged','friendlyHeroLethal'].some(t=>t===c.trigger)&&(c.needsBoardSpace===undefined||typeof c.needsBoardSpace==='boolean')&&(c.needsMinionAttacker===undefined||typeof c.needsMinionAttacker==='boolean')&&c.targetRule===undefined&&Array.isArray(c.effects),'잘못된 비밀 발동 조건 또는 효과');break;
      default:throw new RuleError('지원하지 않는 카드 종류');
    }
    if(c.choices!==undefined)requireRule((c.kind==='minion'||c.kind==='spell')&&c.targetRule===undefined&&c.battlecry===undefined&&c.effects===undefined&&Array.isArray(c.choices)&&c.choices.length>=2&&c.choices.length<=4&&c.choices.every(x=>record(x)&&typeof x.label==='string'&&x.label.trim().length>0&&(x.targetRule===undefined||TARGET_RULES.some(t=>t===x.targetRule))&&Array.isArray(x.effects)),'잘못된 선택 효과');
    catalog[c.id] = structuredClone(c) as unknown as Card;
    }catch(e){if(e instanceof RuleError&&typeof c.id==='string')throw new RuleError(`[${c.id}] ${e.message}`);throw e;}
  }
  catalog.__coin = { id: '__coin', name: '동전', kind: 'coin', cost: 0, effects:[{kind:'gainMana',amount:1}] };
  // Two-pass validation lets JSON cards summon cards declared later in the file.
  const refs:Catalog={...catalog,...Object.fromEntries(HERO_TOKENS.map(c=>[c.id,c]))};
  for(const c of Object.values(catalog)){
    try{
    if(c.kind==='minion'){
      if(c.battlecry!==undefined)validateEffects(c.battlecry,refs,'battlecry',c.targetRule);
      for(const list of [c.deathrattle,c.startTurn,c.endTurn,c.endAnyTurn])if(list!==undefined)validateEffects(list,refs,'trigger');
      for(const trigger of c.triggers??[])validateEffects(trigger.effects,refs,'event');
    }else if(c.kind==='spell'&&c.effects)validateEffects(c.effects,refs,'spell',c.targetRule);
    else if(c.kind==='weapon'){
      if(c.battlecry)validateEffects(c.battlecry,refs,'weaponBattlecry',c.targetRule);
      for(const list of [c.beforeAttack,c.secretRevealed])if(list)validateEffects(list,refs,'weapon');
      if(c.friendlySummon)validateEffects(c.friendlySummon,refs,'event');
    }
    else if(c.kind==='secret')validateEffects(c.effects,refs,'secret');
    if(c.kind==='minion'||c.kind==='spell')for(const choice of c.choices??[])validateEffects(choice.effects,refs,c.kind==='spell'?'spell':'battlecry',choice.targetRule);
    }catch(e){if(e instanceof RuleError)throw new RuleError(`[${c.id}] ${e.message}`);throw e;}
  }
  return catalog;
}
export function validateDeck(deck: Deck, catalog: Catalog): void {
  requireRule(record(deck) && isClass(deck.heroClass) && Array.isArray(deck.cards), '잘못된 덱 정보');
  requireRule(deck.cards.length === RULES.deckSize, '덱은 정확히 30장이어야 합니다.');
  const counts = new Map<string, number>();
  for (const id of deck.cards) {
    requireRule(typeof id === 'string' && Object.hasOwn(catalog, id), '존재하지 않는 카드');
    const c = catalog[id];
    requireRule(c.kind !== 'coin', '동전은 덱에 넣을 수 없습니다.');
    requireRule(c.collectible!==false,'토큰은 덱에 넣을 수 없습니다.');
    requireRule(c.class === 'neutral' || c.class === deck.heroClass, '다른 직업 카드입니다.');
    const count = (counts.get(id) ?? 0) + 1;
    requireRule(count <= maxCardCopies(c), c.rarity==='legendary'?'동일 전설 카드는 최대 1장입니다.':'동일 카드는 최대 2장입니다.');
    counts.set(id, count);
  }
}
function instance(s: GameState, cardId: string): CardInstance {
  const serial=s.nextId++;return { instanceId:opaqueId(s)??`c${serial}`, cardId };
}
function blankPlayer(heroClass: HeroClass): Player {
  return { heroClass, health: RULES.heroHealth, mana: 0, maxMana: 0, armor:0, heroAttack:0, heroAttacksRemaining:0, heroPowerUsed:false, pendingOverload:0,lockedMana:0,cardsPlayedThisTurn:0,weapon:null, secrets:[], fatigue: 0, deck: [], hand: [], board: [], mulliganDone: false };
}
function log(s:GameState,player:PlayerId,message:string):void{
  s.history.push({turn:s.turn,player,message});if(s.history.length>60)s.history.shift();
}
function finish(s: GameState, winner: PlayerId|null, reason: NonNullable<GameState['reason']>): void {
  s.phase = 'finished'; s.winner = winner; s.reason = reason;
  delete s.pendingChoice;
  log(s,winner??s.activePlayer,winner===null?'무승부':`플레이어 ${winner+1} 승리`);
}
function draw(s: GameState, id: PlayerId, deferLethal=false,resolver?:Resolver): string|undefined {
  const p = s.players[id];
  const card = p.deck.shift();
  if (!card) {
    p.fatigue++;
    emitVisual(s,{kind:'fatigue',side:id,target:{kind:'hero',player:id},amount:p.fatigue});
    log(s,id,`탈진 피해 ${p.fatigue}`);
    damage(s,hero(id),p.fatigue,resolver);
    if (p.health === 0&&!deferLethal) finish(s, other(id), 'fatigue');
    return;
  }
  // Full hand burns the drawn card; no fatigue while deck still has cards.
  emitVisual(s,{kind:'draw',side:id,burned:p.hand.length>=RULES.maxHand});
  if (p.hand.length < RULES.maxHand) p.hand.push(card);else log(s,id,'손패가 가득 차 카드 1장 소실');return card.cardId;
}
function startTurn(s: GameState, id: PlayerId): void {
  if(s.turn>=RULES.maxTurns){log(s,s.activePlayer,'최대 89턴 도달');finish(s,null,'turnLimit');return;}
  s.activePlayer = id;
  s.turn++;
  log(s,id,'턴 시작');
  const p = s.players[id];
  p.maxMana = Math.min(RULES.maxMana, p.maxMana + 1);
  p.lockedMana=Math.min(p.maxMana,p.pendingOverload);p.pendingOverload=0;
  p.mana = p.maxMana-p.lockedMana;p.cardsPlayedThisTurn=0;p.minionsPlayedThisTurn=0;
  if(p.freeSpellsNextTurn){p.freeSpellsThisTurn=true;delete p.freeSpellsNextTurn;}
  p.heroAttacksMadeThisTurn=0;p.heroAttacksRemaining=heroAttackLimit(s,id); p.heroPowerUsed=false; p.heroAttack=0;
  for (const m of p.board){m.attacksRemaining = hasKeyword(m,'windfury')?2:1;m.attacksMadeThisTurn=0;}
  for(const player of s.players)for(const m of player.board)if(m.stealthUntilStartOf===id)delete m.stealthUntilStartOf;
  for(const player of s.players)for(const m of player.board)if(m.destroyAtStartOf?.includes(id))m.health=0;
  resolution(s).settle();if(s.phase==='finished')return;
  for(const cardId of p.nextTurnCards??[])if(p.hand.length<RULES.maxHand)p.hand.push(instance(s,cardId));delete p.nextTurnCards;
  if(s.phase==='playing')turnEffects(s,id,'startTurn');
  if(s.phase==='playing')draw(s, id);
}
export function createGame(catalog: Catalog, decks: [Deck, Deck], options: { seed: number; firstPlayer?: PlayerId; runtime?:RuntimeOptions }): GameState {
  requireRule(integer(options.seed, 0, 0xffffffff), 'seed는 32비트 부호 없는 정수여야 합니다.');
  requireRule(options.firstPlayer === undefined || validPlayer(options.firstPlayer), '잘못된 선공 지정');
  validateDeck(decks[0], catalog); validateDeck(decks[1], catalog);
  const s: GameState = {
    phase: 'mulligan', firstPlayer: 0, activePlayer: 0, turn: 0,
    players: [blankPlayer(decks[0].heroClass), blankPlayer(decks[1].heroClass)],
    winner: null, reason: null, catalog: snapshotBattleCatalog(catalog), rng: options.seed, nextId: 1,nextEntryOrder:1, revision: 0,history:[],
  };
  setRuntime(s,options.runtime);
  s.firstPlayer = options.firstPlayer ?? (random(s) < 0.5 ? 0 : 1);
  s.activePlayer = s.firstPlayer;
  for (const id of [0, 1] as const) {
    const p = s.players[id];
    p.deck = decks[id].cards.map(cardId => instance(s, cardId));
    shuffle(s, p.deck);
    for (let i = 0; i < (id === s.firstPlayer ? 3 : 4); i++) draw(s, id);
  }
  return s;
}
function mulligan(s: GameState, id: PlayerId, replacement: unknown): void {
  const p = s.players[id];
  requireRule(!p.mulliganDone, '멀리건을 이미 완료했습니다.');
  requireRule(Array.isArray(replacement) && replacement.every(i => typeof i === 'string'), '잘못된 멀리건 목록');
  const ids = new Set<string>(replacement);
  requireRule(ids.size === replacement.length && [...ids].every(i => p.hand.some(c => c.instanceId === i)), '자신의 손패만 한 번씩 선택할 수 있습니다.');
  const returned = p.hand.filter(c => ids.has(c.instanceId));
  p.hand = p.hand.filter(c => !ids.has(c.instanceId));
  for (const _ of returned) draw(s, id);
  p.deck.push(...returned);
  shuffle(s, p.deck);
  p.mulliganDone = true;
  log(s,id,'시작 카드 선택 완료');
  if (s.players.every(player => player.mulliganDone)) {
    s.players[other(s.firstPlayer)].hand.push(instance(s, '__coin'));
    s.phase = 'playing';
    startTurn(s, s.firstPlayer);
  }
}
function visualTarget(c:Character):Target{return c.kind==='hero'?{kind:'hero',player:c.player}:{kind:'minion',instanceId:c.minion.instanceId};}
function damage(s:GameState,target:Character,amount:number,resolver?:Resolver):boolean {
  if(amount<=0)return false;
  if(target.kind==='hero'){
    const p=s.players[target.player];
    if(p.heroImmuneThisTurn)return false;
    if(s.phase==='playing'&&target.player!==s.activePlayer&&amount>=p.health+p.armor){
      triggerSecrets(s,target.player,'friendlyHeroLethal',target,undefined,undefined,amount,resolver?{...resolver,settle:()=>{}}:undefined);
      if(p.heroImmuneThisTurn)return false;
    }
    const absorbed=Math.min(p.armor,amount);
    const before=p.health;p.armor-=absorbed;p.health=Math.max(0,p.health-(amount-absorbed));log(s,target.player,`영웅 피해 ${before-p.health}${absorbed?` (방어도 ${absorbed} 소모)`:''}`);const actual=absorbed+before-p.health;if(actual>0)emitVisual(s,{kind:'damage',target:visualTarget(target),side:target.player,amount:actual,armorAbsorbed:absorbed});return actual>0;
  } else {
    const m=target.minion;
    if(m.health<=0||m.immuneThisTurn)return false;
    if(hasKeyword(m,'divineShield')){m.keywords=m.keywords!.filter(k=>k!=='divineShield');log(s,target.player,`${s.catalog[m.cardId].name} 천상의 보호막 소모`);emitVisual(s,{kind:'shield',target:visualTarget(target),side:target.player});return false;}
    const before=m.health;m.health=s.players[target.player].protectMinionsThisTurn?Math.max(1,m.health-amount):m.health-amount;if(before>m.health){log(s,target.player,`${s.catalog[m.cardId].name} 피해 ${before-m.health}`);emitVisual(s,{kind:'damage',target:visualTarget(target),side:target.player,amount:before-m.health});}else log(s,target.player,`${s.catalog[m.cardId].name} 생명력 보호`);return before>m.health;
  }
}
function summon(s:GameState,owner:PlayerId,cardId:string,card?:CardInstance,position?:number):Minion|undefined {
  const p=s.players[owner],def=s.catalog[cardId];
  requireRule(def?.kind==='minion','잘못된 소환 카드');
  if(p.board.length>=RULES.maxBoard)return;
  const keywords=[...(def.keywords??[])];
  const enteredOrder=s.nextEntryOrder??1;s.nextEntryOrder=enteredOrder+1;
  const m:Minion={...(card??instance(s,cardId)),originalOwner:owner,attack:def.attack,health:def.health,maxHealth:def.health,attacksRemaining:keywords.includes('charge')&&s.activePlayer===owner?(keywords.includes('windfury')?2:1):0,attacksMadeThisTurn:0,summonedTurn:s.turn,enteredOrder,keywords};
  delete m.costDiscount;
  p.board.splice(position??p.board.length,0,m);if(!card)log(s,owner,`${def.name} 소환`);return m;
}
/** Shared death queue: simultaneous deaths are removed before deathrattles; order of entry is independent of board position. */
function entryOrder(a:Minion,b:Minion):number{return (a.enteredOrder??0)-(b.enteredOrder??0);}
type GameEvent={kind:'summon'|'spell'|'spellPlayed'|'death'|'damage'|'heal'|'overload'|'overloadCardPlayed'|'cardPlayed'|'secretPlayed';owner:PlayerId;target?:Character;cardId?:string};
interface Resolver extends EffectOps {event(event:GameEvent):void}
function resolution(s:GameState):Resolver {
  const queue:{owner:PlayerId;effects:Effect[];source:Character;live?:boolean;eventTarget?:Character;eventCardId?:string;eventOwner?:PlayerId;deathSecret?:boolean;deathrattle?:boolean;weapon?:Weapon}[]=[];
  const damageQueue:typeof queue=[];
  const heroSecretEvents:{owner:PlayerId;target:Character;amount:number}[]=[];
  const placements=new Map<Minion,DeathPlacement>();
  let processing=false,processingDamage=false,budget=256,fatigueLethal=false;
  const effectDraw=(id:PlayerId)=>{const p=s.players[id],previous=p.fatigue,life=p.health+p.armor,card=draw(s,id,true,ops);if(p.fatigue>previous){if(p.health===0)fatigueLethal=true;if(id!==s.activePlayer&&p.health+p.armor<life)heroSecretEvents.push({owner:id,target:hero(id),amount:p.fatigue});}return card;};
  const emit=(event:GameEvent)=>{
    if(event.kind==='summon'&&event.target?.kind==='minion'){
      const w=s.players[event.owner].weapon,def=w?.cardId?s.catalog[w.cardId]:undefined;
      if(def?.kind==='weapon'&&def.friendlySummon)queue.push({owner:event.owner,effects:def.friendlySummon,source:hero(event.owner),eventTarget:event.target,weapon:w!});
    }
    for(const {owner,m} of ([0,1] as const).flatMap(owner=>s.players[owner].board.map(m=>({owner,m}))).sort((a,b)=>entryOrder(a.m,b.m))){
      if((m.health<=0&&event.kind!=='damage')||m.silenced)continue;const def=s.catalog[m.cardId];if(def?.kind!=='minion'||!def.triggers)continue;
      for(const trigger of def.triggers){
        const target=event.target,subject=target?.kind==='minion'?target.minion:undefined;
        const matches=trigger.event==='anyMinionSummoned'?event.kind==='summon'&&subject!==m:trigger.event==='friendlyCardPlayed'?event.kind==='cardPlayed'&&owner===event.owner&&subject!==m:trigger.event==='friendlyOverloadCardPlayed'?event.kind==='overloadCardPlayed'&&owner===event.owner&&subject!==m:trigger.event==='anySecretPlayed'?event.kind==='secretPlayed':trigger.event==='anyCharacterHealed'?event.kind==='heal':trigger.event==='friendlyMinionSummoned'?event.kind==='summon'&&owner===event.owner&&subject!==m:trigger.event==='anySpellPlayed'?event.kind==='spellPlayed':trigger.event==='friendlySpellPlayed'?event.kind==='spellPlayed'&&owner===event.owner:trigger.event==='friendlySpellCast'?event.kind==='spell'&&owner===event.owner:trigger.event==='friendlyMinionDied'?event.kind==='death'&&owner===event.owner:trigger.event==='anyMinionDied'?event.kind==='death':trigger.event==='anyMinionHealed'?event.kind==='heal'&&!!subject:trigger.event==='friendlyMinionDamaged'?event.kind==='damage'&&owner===event.owner:trigger.event==='anyMinionDamaged'?event.kind==='damage':trigger.event==='friendlyOverload'?event.kind==='overload'&&owner===event.owner:event.kind==='damage'&&subject===m;
        if(!matches)continue;
        if(trigger.tribe){const c=subject?s.catalog[subject.cardId]:undefined;if(c?.kind!=='minion'||c.tribe!==trigger.tribe)continue;}
        (event.kind==='damage'?damageQueue:queue).push({owner,effects:trigger.effects,source:{kind:'minion',player:owner,minion:m},live:event.kind!=='damage',eventTarget:target,eventCardId:event.cardId,eventOwner:event.owner});
      }
    }
  };
  const ops:Resolver={event:emit,overload:id=>emit({kind:'overload',owner:id}),deathPlacement:m=>placements.get(m),damage:(c,n)=>{const dealt=damage(s,c,n,ops);if(c.kind==='hero'&&dealt&&c.player!==s.activePlayer&&s.phase==='playing')heroSecretEvents.push({owner:c.player,target:c,amount:n});if(c.kind==='minion'&&dealt)emit({kind:'damage',owner:c.player,target:c});return dealt;},heal:(c,n)=>{if(c.kind==='hero'){const p=s.players[c.player];const before=p.health;p.health=Math.min(p.maxHealth??RULES.heroHealth,p.health+n);if(p.health>before){emitVisual(s,{kind:'heal',target:visualTarget(c),side:c.player,amount:p.health-before});emit({kind:'heal',owner:c.player,target:c});}}else{const before=c.minion.health;c.minion.health=Math.min(c.minion.maxHealth,before+n);if(c.minion.health>before){emitVisual(s,{kind:'heal',target:visualTarget(c),side:c.player,amount:c.minion.health-before});emit({kind:'heal',owner:c.player,target:c});}}},draw:id=>{effectDraw(id);},drawCard:effectDraw,summon:(id,c,card,position)=>{const m=summon(s,id,c,card,position);if(m)emit({kind:'summon',owner:id,target:{kind:'minion',player:id,minion:m}});return m;},addCard:(id,c)=>{if(s.players[id].hand.length<RULES.maxHand)s.players[id].hand.push(instance(s,c));},settle:()=>{
    if(s.phase==='finished'||processingDamage)return;
    // Damage reactions resolve before removing mortally wounded minions, so
    // armor and draw effects can trigger on their source's lethal damage.
    processingDamage=true;
    while((heroSecretEvents.length||damageQueue.length)&&(s as GameState).phase!=='finished'){
      if(heroSecretEvents.length){const e=heroSecretEvents.shift()!;triggerSecrets(s,e.owner,'friendlyHeroDamaged',e.target,undefined,undefined,e.amount,ops);continue;}
      requireRule(--budget>=0,'효과 연쇄 처리 한도를 초과했습니다.');
      const next=damageQueue.shift()!;resolveEffects(s,next.effects,{owner:next.owner,source:next.source,eventTarget:next.eventTarget},ops);
    }
    processingDamage=false;
    if((s as GameState).phase==='finished'){for(const p of s.players)p.board=p.board.filter(m=>m.health>0);return;}
    let changed:boolean;
    // Aura loss can cause additional death waves before any deathrattle runs.
    // Keep the initial positional anchors throughout that entire removal phase.
    const waveSlots:[DeathSlot[]|undefined,DeathSlot[]|undefined]=[undefined,undefined];
    do{
      refreshAuras(s);changed=false;
      const dead=([0,1] as const).flatMap(id=>{
        const board=s.players[id].board;if(!board.some(m=>m.health<=0))return [];
        const slots=waveSlots[id]??=board.map(minion=>({minion,replacements:[]}));
        return board.flatMap(m=>{if(m.health>0)return [];const index=slots.findIndex(slot=>slot.minion===m);placements.set(m,{slots,index});return [{id,m}];});
      }).sort((a,b)=>entryOrder(a.m,b.m));
      if(dead.length)changed=true;
      for(const p of s.players)p.board=p.board.filter(m=>m.health>0);
      for(const {id,m} of dead){const c=s.catalog[m.cardId],source={kind:'minion' as const,player:id,minion:m,deathPlacement:placements.get(m)};if(c)log(s,id,`${c.name} 사망`);emitVisual(s,{kind:'death',target:visualTarget(source),side:id});if(!m.silenced&&c?.kind==='minion'&&c.deathrattle)queue.push({owner:id,effects:c.deathrattle,source,deathrattle:true});if(m.deathrattleSummons?.length)queue.push({owner:id,effects:m.deathrattleSummons.map(cardId=>({kind:'summon',cardId,count:1})),source,deathrattle:true});emit({kind:'death',owner:id,target:source});if(id!==s.activePlayer&&s.phase==='playing')queue.push({owner:id,effects:[],source,deathSecret:true});}
    }while(changed);
    if(s.players.some(p=>p.health===0)){
      const winner=s.players[0].health===0?(s.players[1].health===0?null:1):0;
      finish(s,winner,fatigueLethal?'fatigue':'health');return;
    }
    if(processing)return;
    processing=true;
    while(queue.length&&(s as GameState).phase!=='finished'){
      requireRule(--budget>=0,'효과 연쇄 처리 한도를 초과했습니다.');
      const next=queue.shift()!;if(next.weapon&&s.players[next.owner].weapon!==next.weapon)continue;if(next.deathSecret){triggerSecrets(s,next.owner,'friendlyMinionDied',next.source,undefined,undefined,undefined,ops);continue;}if(next.live&&next.source.kind==='minion'&&(!s.players[next.owner].board.includes(next.source.minion)||next.source.minion.silenced))continue;
      if(next.deathrattle)emitVisual(s,{kind:'deathrattle',side:next.owner,target:visualTarget(next.source)});
      resolveEffects(s,next.effects,{owner:next.owner,source:next.source,eventTarget:next.eventTarget,eventCardId:next.eventCardId,eventOwner:next.eventOwner},ops);
    }
    processing=false;
  }};
  return ops;
}
function runEffects(s:GameState,effects:Effect[],ctx:EffectContext):void {resolveEffects(s,effects,ctx,resolution(s));}
function turnEffects(s:GameState,owner:PlayerId,trigger:'startTurn'|'endTurn'):void {
  const snapshot=([owner,other(owner)] as PlayerId[]).flatMap(id=>s.players[id].board.map(m=>({id,m}))).sort((a,b)=>entryOrder(a.m,b.m));
  for(const {id,m} of snapshot){if(s.phase==='finished')break;if(m.silenced||!s.players[id].board.includes(m))continue;const c=s.catalog[m.cardId];if(c?.kind!=='minion')continue;
    if(id===owner&&c[trigger])runEffects(s,c[trigger]!,{owner:id,source:{kind:'minion',player:id,minion:m}});
    if(trigger==='endTurn'&&c.endAnyTurn&&s.players[id].board.includes(m))runEffects(s,c.endAnyTurn,{owner:id,source:{kind:'minion',player:id,minion:m}});
  }
}
function spellPowerMultiplier(s:GameState,id:PlayerId):number{return s.players[id].board.reduce((n,m)=>{const c=s.catalog[m.cardId];return n*(!m.silenced&&m.health>0&&c?.kind==='minion'?(c.spellAndPowerMultiplier??1):1);},1);}
/** Temporary control lasts through the current player's end-turn effects. */
function returnTemporaryControl(s:GameState,actor:PlayerId):void{
  const p=s.players[actor];let changed=false;
  for(const m of [...p.board]){
    const dest=m.returnController;if(dest===undefined)continue;delete m.returnController;changed=true;
    const q=s.players[dest];
    if(q.board.length>=RULES.maxBoard){m.health=0;continue;}
    p.board=p.board.filter(x=>x!==m);m.attacksRemaining=0;q.board.push(m);log(s,actor,`${s.catalog[m.cardId].name} 조종 종료`);
  }
  if(changed)resolution(s).settle();
}
function triggerSecrets(s:GameState,owner:PlayerId,trigger:SecretTrigger,eventTarget?:Character,eventAttacker?:Character,attackEvent?:{target:Character},eventDamage?:number,resolver?:Resolver,spellEvent?:{target?:Character}):boolean {
  const p=s.players[owner];
  for(const secret of [...p.secrets]){
    if(s.phase==='finished')return true;
    const c=s.catalog[secret.cardId];
    if(c?.kind!=='secret')continue;
    const current=attackEvent?.target??spellEvent?.target??eventTarget;
    const matches=attackEvent?(c.trigger==='enemyAttackAny'||c.trigger==='enemyAttackHero'&&current?.kind==='hero'&&current.player===owner||c.trigger==='enemyMinionAttack'&&eventAttacker?.kind==='minion'||c.trigger==='enemyAttackFriendlyMinion'&&current?.kind==='minion'&&current.player===owner):c.trigger===trigger||trigger==='enemyCastSpell'&&c.trigger==='enemyTargetMinionSpell'&&current?.kind==='minion';
    if(!matches||c.needsBoardSpace&&p.board.length>=RULES.maxBoard||c.needsMinionAttacker&&eventAttacker?.kind!=='minion')continue;
    if(c.effects.some(e=>e.kind==='redirectAttackRandom')&&eventAttacker?.kind==='hero'&&!s.players.some(p=>p.board.length))continue;
    p.secrets=p.secrets.filter(x=>x.instanceId!==secret.instanceId);
    log(s,owner,`비밀 발동: ${c.name}`);
    emitVisual(s,{kind:'secretTriggered',cardId:c.id,side:owner});
    const ctx:EffectContext={owner,eventTarget:current,eventAttacker,eventDamage};if(resolver)resolveEffects(s,c.effects,ctx,resolver);else runEffects(s,c.effects,ctx);if(attackEvent&&ctx.redirected)attackEvent.target=ctx.redirected;if(spellEvent&&ctx.redirected)spellEvent.target=ctx.redirected;
    for(const wielder of [owner,other(owner)]){const w=s.players[wielder].weapon,weapon=w?.cardId?s.catalog[w.cardId]:undefined;if(s.phase==='playing'&&weapon?.kind==='weapon'&&weapon.secretRevealed&&(wielder===owner||weapon.secretRevealedSide==='both')){if(resolver)resolveEffects(s,weapon.secretRevealed,{owner:wielder},resolver);else runEffects(s,weapon.secretRevealed,{owner:wielder});}}
    if(ctx.canceled || (eventAttacker?.kind==='minion'&&(eventAttacker.minion.health<=0||!s.players[eventAttacker.player].board.includes(eventAttacker.minion))))return true;
  }
  return false;
}
function playCard(s: GameState, id: PlayerId, instanceId: unknown, target:unknown, position:unknown,choiceIndex:unknown): void {
  const p = s.players[id];
  const index = p.hand.findIndex(c => c.instanceId === instanceId);
  requireRule(index >= 0, '자신의 손패에 없는 카드입니다.');
  const card = p.hand[index];
  const def = s.catalog[card.cardId];
  const cost=currentCost(def,s.catalog,id,[s.players[0].board,s.players[1].board],p.weapon,card.costDiscount,p.nextSecretFree,p.minionsPlayedThisTurn,{handCount:p.hand.length,health:p.health,maxHealth:p.maxHealth,nextSpellDiscount:p.nextSpellDiscount,freeSpellsThisTurn:p.freeSpellsThisTurn});
  requireRule(p.mana >= cost, '마나가 부족합니다.');
  if (def.kind === 'minion') {
    requireRule(p.board.length < RULES.maxBoard, '전장은 최대 7개 하수인입니다.');
    requireRule(position===undefined||integer(position,0,p.board.length),'잘못된 배치 위치');
  } else {
    requireRule(position===undefined,'하수인만 배치 위치를 지정할 수 있습니다.');
  }
  const choices=(def.kind==='minion'||def.kind==='spell')?def.choices:undefined;
  requireRule(choices?integer(choiceIndex,0,choices.length-1):choiceIndex===undefined,'올바른 카드 효과를 선택해야 합니다.');
  const choice=choices?.[choiceIndex as number];
  const effects=choice?.effects??(def.kind==='minion'||def.kind==='weapon'?def.battlecry:def.kind==='spell'||def.kind==='coin'?def.effects:undefined);
  const rule=effectiveTargetRule(def,p.cardsPlayedThisTurn>0,choiceIndex as number|undefined);
  const chosen=chooseTarget(s,id,rule,target,def.kind==='minion'||def.kind==='weapon',def.kind==='spell');
  if(def.kind==='spell'){const reason=spellRequirementReason(effects,p,s.players[other(id)]);requireRule(!reason,reason??'주문을 사용할 수 없습니다.');}
  if(def.kind==='secret'){
    requireRule(p.secrets.length<RULES.maxSecrets,'비밀은 최대 5개입니다.');
    requireRule(!p.secrets.some(c=>c.cardId===def.id),'같은 비밀은 동시에 사용할 수 없습니다.');
  }
  p.mana -= cost;if(def.kind==='secret')delete p.nextSecretFree;if(def.kind==='spell'||def.kind==='coin'||def.kind==='secret')delete p.nextSpellDiscount;
  p.hand.splice(index, 1);
  const comboActive=p.cardsPlayedThisTurn>0;p.cardsPlayedThisTurn++;if(def.kind==='minion')p.minionsPlayedThisTurn=(p.minionsPlayedThisTurn??0)+1;
  log(s,id,def.kind==='secret'?'비밀 설치':`${def.name} 사용${choice?` (${choice.label})`:''}`);
  const overloadCard=effects?.some(e=>e.kind==='overload');
  if(def.kind!=='minion'){const ops=resolution(s);ops.event({kind:'cardPlayed',owner:id});if(overloadCard)ops.event({kind:'overloadCardPlayed',owner:id});ops.settle();if(s.phase==='finished')return;}
  if(def.kind==='spell'||def.kind==='coin'||def.kind==='secret'){const ops=resolution(s);ops.event({kind:'spellPlayed',owner:id,target:chosen,cardId:def.id});if(def.kind==='secret')ops.event({kind:'secretPlayed',owner:id});ops.settle();if(s.phase==='finished')return;}
  switch(def.kind){
    case 'minion':{
      const m=summon(s,id,def.id,card,position as number|undefined)!;
      const source:Character={kind:'minion',player:id,minion:m};const cardOps=resolution(s);cardOps.event({kind:'cardPlayed',owner:id,target:source});if(overloadCard)cardOps.event({kind:'overloadCardPlayed',owner:id,target:source});cardOps.settle();
      resolution(s).settle();
      if(effects)runEffects(s,effects,{owner:id,chosen,source,comboActive});
      if(p.board.includes(m)&&s.phase==='playing'){const ops=resolution(s);ops.event({kind:'summon',owner:id,target:source});ops.settle();}
      if(p.board.includes(m)&&s.phase==='playing')triggerSecrets(s,other(id),'enemyPlayMinion',source);
      break;
    }
    case 'spell':case 'coin':{
      const spellEvent={target:chosen};const canceled=triggerSecrets(s,other(id),'enemyCastSpell',chosen,undefined,undefined,undefined,undefined,spellEvent);
      if(!canceled&&s.phase==='playing'){
        const spellDamage=p.board.reduce((sum,m)=>{const c=s.catalog[m.cardId];return sum+(!m.silenced&&c?.kind==='minion'?(c.spellDamage??0)+(m.bonusSpellDamage??0):0);},0);
        runEffects(s,effects??[],{owner:id,chosen:spellEvent.target,spellDamage,spellPowerMultiplier:spellPowerMultiplier(s,id),comboActive});
        if(s.phase==='playing'&&!s.pendingChoice){const ops=resolution(s);ops.event({kind:'spell',owner:id,target:chosen});ops.settle();}
      }break;
    }
    case 'weapon':p.weapon={attack:def.attack,durability:def.durability,cardId:def.id};p.heroAttacksRemaining=Math.max(0,heroAttackLimit(s,id)-(p.heroAttacksMadeThisTurn??0));resolution(s).settle();if(effects)runEffects(s,effects,{owner:id,chosen,comboActive});break;
    case 'secret':{
      if(!triggerSecrets(s,other(id),'enemyCastSpell')&&s.phase==='playing'){
        p.secrets.push(card);const ops=resolution(s);ops.event({kind:'spell',owner:id});ops.settle();
      }break;
    }
  }
}
function attackTarget(s:GameState,id:PlayerId,target:unknown):Character {
  requireRule(record(target), '잘못된 공격 대상');
  const d=lookupTarget(s,id,target);
  requireRule(d.player===other(id),'상대 전장의 하수인 또는 영웅만 공격 가능합니다.');
  requireRule(d.kind==='hero'?!s.players[d.player].heroImmuneThisTurn:!d.minion.immuneThisTurn&&!hasKeyword(d.minion,'stealth'),'은신 또는 면역인 대상은 공격할 수 없습니다.');
  const taunts=s.players[other(id)].board.filter(m=>hasKeyword(m,'taunt')&&!hasKeyword(m,'stealth')&&!m.immuneThisTurn);
  requireRule(!taunts.length||(d.kind==='minion'&&taunts.includes(d.minion)),'도발 하수인을 먼저 공격해야 합니다.');
  return d;
}
function combat(s:GameState,attacker:Character,defender:Character,attackValue:number):void {
  emitVisual(s,{kind:'combat',target:visualTarget(defender),side:defender.player});
  const retaliation=defender.kind==='minion'?defender.minion.attack:0;
  const name=(c:Character)=>c.kind==='hero'?'영웅':s.catalog[c.minion.cardId]?.name??'하수인';
  log(s,attacker.player,`${name(attacker)} → ${name(defender)} 공격 (${attackValue})`);
  const ops=resolution(s),dealt=ops.damage(defender,attackValue);let returned=false;
  if(retaliation>0){if(defender.kind==='minion'){defender.minion.keywords=defender.minion.keywords?.filter(k=>k!=='stealth');delete defender.minion.stealthUntilStartOf;}returned=ops.damage(attacker,retaliation);}
  minionDamageResult(s,attacker,defender,dealt);minionDamageResult(s,defender,attacker,returned);
  ops.settle();
}
function attack(s:GameState,id:PlayerId,attackerId:unknown,target:unknown):void {
  const a=s.players[id].board.find(m=>m.instanceId===attackerId);
  requireRule(a&&a.attacksRemaining>0&&a.attack>0&&(a.silenced||!(s.catalog[a.cardId].kind==='minion'&&(s.catalog[a.cardId] as import('./types.ts').MinionCard).noAttack)), '공격할 수 없는 하수인입니다.');
  requireRule(a.frozenThroughTurn===undefined,'빙결된 하수인은 공격할 수 없습니다.');
  let d=attackTarget(s,id,target);const source:Character={kind:'minion',player:id,minion:a};
  a.attacksRemaining--;a.attacksMadeThisTurn=(a.attacksMadeThisTurn??0)+1;a.keywords=a.keywords?.filter(k=>k!=='stealth');
  delete a.stealthUntilStartOf;
  const attackEvent={target:d};if(triggerSecrets(s,other(id),'enemyAttackAny',d,source,attackEvent))return;d=attackEvent.target;
  if(s.phase==='playing'&&a.health>0&&s.players[id].board.includes(a)&&(d.kind==='hero'||s.players[d.player].board.includes(d.minion))){for(const owner of a.drawOnAttackOwners??[])if(s.phase==='playing')draw(s,owner);if(s.phase==='playing')combat(s,source,d,a.attack);}
}
function heroAttackLimit(s:GameState,id:PlayerId):number {const w=s.players[id].weapon,def=w?.cardId?s.catalog[w.cardId]:undefined;return def?.kind==='weapon'&&def.windfury?2:1;}
function heroAttack(s:GameState,id:PlayerId,target:unknown):void {
  const p=s.players[id];
  requireRule(p.heroAttacksRemaining>0&&(p.heroAttacksMadeThisTurn??0)<heroAttackLimit(s,id)&&p.heroAttack+(p.weapon?.attack??0)>0,'영웅이 공격할 수 없습니다.');
  requireRule(p.heroFrozenThroughTurn===undefined,'빙결된 영웅은 공격할 수 없습니다.');
  let d=attackTarget(s,id,target);const source=hero(id);p.heroAttacksRemaining--;p.heroAttacksMadeThisTurn=(p.heroAttacksMadeThisTurn??0)+1;
  const hadImmunity=p.heroImmuneThisTurn;let immune=false;
  try {
  const attackEvent={target:d};if(triggerSecrets(s,other(id),'enemyAttackAny',d,source,attackEvent))return;d=attackEvent.target;
  if(s.phase==='finished')return;
  const ability=p.weapon?.cardId?s.catalog[p.weapon.cardId]:undefined;
  if(ability?.kind==='weapon'&&ability.beforeAttack)runEffects(s,ability.beforeAttack,{owner:id});
  if(s.phase!=='playing'||(d.kind==='minion'&&!s.players[d.player].board.includes(d.minion)))return;
  const weapon=p.weapon;
  // June 2014: Longbow prevented combat retaliation, not the earlier
  // attack-triggered secret damage (that interaction changed in 2016).
  immune=ability?.kind==='weapon'&&ability.immuneWhileAttacking===true;if(immune)p.heroImmuneThisTurn=true;
  combat(s,source,d,p.heroAttack+(weapon?.attack??0));
  if(weapon&&p.weapon===weapon){if(ability?.kind==='weapon'&&ability.attackLossVsMinion&&d.kind==='minion'){weapon.attack--;if(weapon.attack<=0)p.weapon=null;}else{weapon.durability--;if(weapon.durability<=0)p.weapon=null;}refreshAuras(s);}
  }finally{if(immune&&!hadImmunity)delete p.heroImmuneThisTurn;p.heroAttacksRemaining=Math.max(0,heroAttackLimit(s,id)-(p.heroAttacksMadeThisTurn??0));}
}
function heroPower(s:GameState,id:PlayerId,target:unknown):void {
  const p=s.players[id],power=getHeroPower(p);
  const reason=heroPowerReason(p);requireRule(!reason,reason??'영웅 능력을 사용할 수 없습니다.');
  const chosen=chooseTarget(s,id,power.targetRule,target,false,true);p.heroPowerUsed=true;p.mana-=power.cost;
  log(s,id,`영웅 능력: ${power.name}`);
  runEffects(s,power.effects,{owner:id,chosen,spellPowerMultiplier:spellPowerMultiplier(s,id)});
}
/** Pure transaction: all invalid actions throw without altering the input state. */
export function applyAction(state: GameState, actor: PlayerId, action: unknown, runtime?:RuntimeOptions): GameState {
  requireRule(validPlayer(actor), '잘못된 플레이어');
  requireRule(state.phase !== 'finished', '이미 종료된 게임입니다.');
  requireRule(record(action), '잘못된 행동');
  const {catalog,...dynamic}=state;
  const s:GameState={...structuredClone(dynamic),catalog:snapshotBattleCatalog(catalog)};
  setRuntime(s,runtime);
  if (action.type === 'concede') {log(s,actor,'항복');finish(s, other(actor), 'concede');}
  else if (s.phase === 'mulligan') {
    requireRule(action.type === 'mulligan', '멀리건을 먼저 완료해야 합니다.');
    mulligan(s, actor, action.replace);
  } else {
    requireRule(actor === s.activePlayer, '자신의 턴이 아닙니다.');
    requireRule(!s.pendingChoice||action.type==='chooseDeckCard','덱 카드 선택을 먼저 완료해야 합니다.');
    switch (action.type) {
      case 'chooseDeckCard':{
        const choice=s.pendingChoice;requireRule(choice?.owner===actor,'선택할 카드가 없습니다.');
        const card=choice.cards.find(c=>c.instanceId===action.instanceId);requireRule(card,'잘못된 카드 선택');
        delete s.pendingChoice;const p=s.players[actor];if(p.hand.length<RULES.maxHand)p.hand.push(card);
        log(s,actor,'덱 카드 선택 완료');const ops=resolution(s);ops.event({kind:'spell',owner:actor});ops.settle();break;
      }
      case 'playCard': playCard(s, actor, action.instanceId,action.target,action.position,action.choice); break;
      case 'attack': attack(s, actor, action.attackerId, action.target); break;
      case 'heroAttack':heroAttack(s,actor,action.target);break;
      case 'heroPower':heroPower(s,actor,action.target);break;
      case 'endTurn':{
        turnEffects(s,actor,'endTurn');const p=s.players[actor];p.heroAttack=0;delete p.protectMinionsThisTurn;delete p.nextSecretFree;delete p.nextSpellDiscount;delete p.freeSpellsThisTurn;
        for(const player of s.players){delete player.heroImmuneThisTurn;for(const m of player.board)delete m.immuneThisTurn;}
        if(s.phase==='playing')for(const player of s.players)for(const m of player.board)if(m.destroyAtEndOf?.includes(actor))m.health=0;
        resolution(s).settle();
        for(const player of s.players)for(const m of player.board){m.attack=Math.max(0,m.attack-(m.temporaryAttack??0));m.temporaryAttack=0;}
        if(p.heroFrozenThroughTurn!==undefined&&p.heroFrozenThroughTurn<=s.turn)delete p.heroFrozenThroughTurn;
        for(const m of p.board)if(m.frozenThroughTurn!==undefined&&m.frozenThroughTurn<=s.turn)delete m.frozenThroughTurn;
        if(s.phase==='playing')returnTemporaryControl(s,actor);
        if(s.phase==='playing')startTurn(s, other(actor));break;
      }
      default: throw new RuleError('지원하지 않는 행동');
    }
  }
  s.revision++;
  return s;
}
function publicPlayer(p: Player): PublicPlayer {
  return { heroClass: p.heroClass, health: p.health, mana: p.mana, maxMana: p.maxMana, armor:p.armor,heroAttack:p.heroAttack,heroAttacksRemaining:p.heroAttacksRemaining,heroAttacksMadeThisTurn:p.heroAttacksMadeThisTurn,heroPowerUsed:p.heroPowerUsed,heroImmuneThisTurn:p.heroImmuneThisTurn,shadowformLevel:p.shadowformLevel,heroForm:p.heroForm,maxHealth:p.maxHealth,freeSpellsThisTurn:p.freeSpellsThisTurn,freeSpellsNextTurn:p.freeSpellsNextTurn,nextSpellDiscount:p.nextSpellDiscount,protectMinionsThisTurn:p.protectMinionsThisTurn,nextSecretFree:p.nextSecretFree,heroFrozenThroughTurn:p.heroFrozenThroughTurn,pendingOverload:p.pendingOverload,lockedMana:p.lockedMana,cardsPlayedThisTurn:p.cardsPlayedThisTurn,minionsPlayedThisTurn:p.minionsPlayedThisTurn,weapon:structuredClone(p.weapon),secretCount:p.secrets.length,fatigue: p.fatigue, board: structuredClone(p.board), deckCount: p.deck.length, handCount: p.hand.length, mulliganDone: p.mulliganDone };
}
/** Whitelist, never serialize the complete GameState to a client. */
export function getPlayerView(s: GameState, viewer: PlayerId): PlayerView {
  requireRule(validPlayer(viewer), '잘못된 플레이어');
  const self = s.players[viewer];
  return { phase: s.phase, activePlayer: s.activePlayer, firstPlayer: s.firstPlayer, turn: s.turn, winner: s.winner, reason: s.reason, revision: s.revision,history:structuredClone(s.history), ...(s.pendingChoice?{choicePending:true}:{}), self: { ...publicPlayer(self), hand: structuredClone(self.hand),secrets:structuredClone(self.secrets), ...(s.pendingChoice?.owner===viewer?{pendingChoice:structuredClone(s.pendingChoice.cards)}:{}) }, opponent: publicPlayer(s.players[other(viewer)]) };
}
