export type PlayerId = 0 | 1;
export type HeroClass = 'warrior' | 'shaman' | 'rogue' | 'paladin' | 'hunter' | 'druid' | 'warlock' | 'mage' | 'priest';
export type Rarity = 'basic' | 'common' | 'rare' | 'epic' | 'legendary';
export type Tribe = 'beast' | 'demon' | 'dragon' | 'murloc' | 'pirate' | 'totem' | 'none';
export type Keyword = 'taunt' | 'charge' | 'divineShield' | 'windfury' | 'stealth' | 'poisonous';
export type TargetRule = 'anyCharacter' | 'enemyCharacter' | 'friendlyCharacter' | 'anyHero' | 'anyMinion' | 'enemyMinion' | 'friendlyMinion' | 'damagedMinion' | 'enemyDamagedMinion' | 'undamagedMinion' | 'lowAttackEnemyMinion' | 'highAttackEnemyMinion' | 'lowAttackMinion' | 'highAttackMinion' | 'friendlyBeastMinion' | 'demonMinion' | 'attackAtLeast7Minion' | 'enemyAttackAtMost2Minion' | 'murlocMinion' | 'tauntMinion' | 'enemyTauntMinion';
export type Selector = 'chosen' | 'self' | 'friendlyHero' | 'enemyHero' | 'friendlyMinions' | 'enemyMinions' | 'allMinions' | 'otherMinions' | 'allCharacters' | 'friendlyCharacters' | 'enemyCharacters' | 'otherCharacters' | 'randomEnemy' | 'randomFriendlyMinion' | 'randomOtherFriendlyMinion' | 'randomDamagedFriendlyCharacter' | 'randomEnemyMinion' | 'eventTarget' | 'eventAttacker' | 'adjacent' | 'chosenAndAdjacent' | 'randomLowAttackEnemyMinion' | 'otherFriendlyMinions' | 'randomMinion' | 'randomOtherMinion' | 'randomDamagedCharacter';
export type EffectCondition = { kind: 'friendlyTribe'; tribe: Tribe; minCount?: number } | {kind:'combo'} | {kind:'chosenSurvived'} | {kind:'chosenDied'} | {kind:'chosenFriendlyTribe';tribe:Tribe;negate?:boolean} | {kind:'enemyMinionCount';minCount:number} | {kind:'eventTargetAttackAtMost';amount:number} | {kind:'chosenFrozen';negate?:boolean} | {kind:'hasSecret'} | {kind:'chance';percent:number};
type TargetedEffect = { target: Selector; tribe?: Tribe; condition?: EffectCondition };
export type Effect =
  | (TargetedEffect & { kind: 'damage'; amount: number; amountMax?:number; excludeCardId?:string; bonusIfTribe?:{tribe:Tribe;amount:number}; bonusIfHeroHealthAtMost?:{health:number;amount:number}; bonusIfCombo?:number })
  | (TargetedEffect & { kind: 'heal'; amount: number })
  | (TargetedEffect & {kind:'healFull'})
  | (TargetedEffect & {kind:'deferredDestroy';timing?:'startTurn'|'endTurn'})
  | {kind:'damageDistinct';count:number;amount:number;condition?:EffectCondition}
  | {kind:'damageSplash';target:'chosen';amount:number;splash:number;scope:'enemyCharacters'|'chosenAndAdjacent';condition?:EffectCondition}
  | (TargetedEffect & {kind:'multiplyHealth';factor:number})
  | (TargetedEffect & {kind:'damageFromHeroAttack'})
  | (TargetedEffect & {kind:'damageFromArmor'|'immuneThisTurn'|'copyChosenMinion'})
  | {kind:'brawl'|'consumeDivineShields'|'shadowform';condition?:EffectCondition}
  | {kind:'discountNextSpell'|'drawDiscounted';amount:number;condition?:EffectCondition}
  | {kind:'summonEnemyDeckMinion';fallbackCardId:string;condition?:EffectCondition}
  | {kind:'heroImmuneThisTurn';condition?:EffectCondition}
  | (TargetedEffect & {kind:'grantDeathrattleSummon';cardId?:string})
  | (TargetedEffect & {kind:'temporaryStealth'})
  | (TargetedEffect & {kind:'betrayal'})
  | {kind:'weaponBurst';condition?:EffectCondition}
  | {kind:'addCardNextTurn';cardId:string;condition?:EffectCondition}
  | {kind:'drawTribe';tribe:Tribe;count:number;fallbackCardId?:string;condition?:EffectCondition}
  | {kind:'loseCrystal';amount:number;condition?:EffectCondition}
  | {kind:'consumeAdjacent';condition?:EffectCondition}
  | (TargetedEffect & {kind:'sacrificeBlast'})
  | (TargetedEffect & {kind:'attackToHealth'|'doubleAttack'|'drawOnAttack'|'removeStealth'})
  | (TargetedEffect & {kind:'drawCostDamage'|'swapStats'})
  | (TargetedEffect & {kind:'grantSpellDamage';amount:number})
  | {kind:'damageWeapon';side:'friendly'|'enemy';amount:number;condition?:EffectCondition}
  | {kind:'nextSecretFree'|'destroyEnemySecrets'|'swapHandMinion';condition?:EffectCondition}
  | {kind:'redirectAttackRandom'|'copyEventMinion'|'reviveEventMinion'|'reflectDamage';condition?:EffectCondition}
  | {kind:'redirectAttackSummon';cardId:string;condition?:EffectCondition}
  | {kind:'missiles';target:'randomEnemy'|'randomEnemyMinion'|'randomOtherCharacter';count:number;amount:number;condition?:EffectCondition}
  | (TargetedEffect & { kind: 'buff'; attack: number; health: number; per?:'otherFriendlyMinions'|'hand'|'enemyHand'|'friendlyWeaponAttack'|'previousCards' })
  | (TargetedEffect & { kind: 'destroy' | 'freeze' | 'silence' })
  | (TargetedEffect & {kind:'bounce';discount?:number})
  | (TargetedEffect & { kind:'transform'; cardId:string })
  | (TargetedEffect & { kind:'randomTransform'; cardIds:string[] })
  | {kind:'setHeroHealth';target:'chosen';amount:number;condition?:EffectCondition}
  | {kind:'replaceHero';form:'jaraxxus';health:number;weaponCardId:string;condition?:EffectCondition}
  | {kind:'enemyFreeSpellsNextTurn'|'destroyEnemyWeaponDraw'|'copySpellToOther';condition?:EffectCondition}
  | (TargetedEffect & { kind:'giveKeyword'; keyword:Keyword })
  | (TargetedEffect & { kind:'control'|'temporaryControl' })
  | (TargetedEffect & { kind:'setStats'; attack?:number; health?:number })
  | (TargetedEffect & { kind:'temporaryAttack'; amount:number })
  | {kind:'destroyWeapon'; side:'friendly'|'enemy'; condition?:EffectCondition}
  | {kind:'buffWeapon'; attack:number; durability:number; condition?:EffectCondition; equipIfMissing?:{attack:number;durability:number}}
  | {kind:'protectMinionsThisTurn';condition?:EffectCondition}
  | {kind:'copyEnemyCard'; zone:'hand'|'deck'; count:number; condition?:EffectCondition}
  | {kind:'draw';amount:number;side?:'friendly'|'enemy'|'both';per?:'damagedFriendlyCharacters'|'enemyHandDifference';condition?:EffectCondition}
  | { kind: 'gainMana' | 'armor' | 'heroAttack' | 'overload' | 'discard'; amount: number; condition?: EffectCondition }
  | {kind:'gainCrystal';amount:number;overflowCardId?:string;filled?:boolean;side?:'friendly'|'enemy';condition?:EffectCondition}
  | {kind:'chooseTopDeck';count:number;condition?:never}
  | { kind:'addCard'; cardId:string; count:number; side?:'friendly'|'enemy'|'both'; condition?:EffectCondition }
  | { kind:'addRandomCard'; cardIds:string[]; count:number; side?:'friendly'|'enemy'|'both'; condition?:EffectCondition }
  | { kind: 'summon'; cardId: string; count: number; countMax?:number; side?:'friendly'|'enemy'; per?:'enemyMinions'; condition?: EffectCondition }
  | { kind: 'summonUniqueRandom'; cardIds: string[]; condition?: EffectCondition }
  | { kind: 'summonRandom'; cardIds: string[]; condition?: EffectCondition }
  | { kind: 'equip'; attack: number; durability: number; cardId?:string; condition?: EffectCondition }
  | { kind: 'cancelEvent'; condition?: EffectCondition };
export interface CardBase {
  id: string;
  name: string;
  cost: number;
  rarity: Rarity;
  class: HeroClass | 'neutral';
  description: string;
  collectible?: boolean;
}
export interface MinionCard extends CardBase {
  kind: 'minion'; attack: number; health: number; tribe: Tribe;
  keywords?: Keyword[];
  spellDamage?: number;
  enrageAttack?: number;
  enrageWindfury?:boolean;
  enrageWeaponAttack?:number;
  noAttack?:boolean;
  chargeWithWeapon?:boolean;
  untargetableBySpells?:boolean;
  freezeOnCombatDamage?: boolean;
  attackEqualsHealth?:boolean;
  healingToDamage?:boolean;
  spellAndPowerMultiplier?:number;
  attackPerOtherTribe?:{tribe:Tribe;amount:number};
  turnTimeLimitSeconds?:number;
  costAuras?: CostAura[];
  discountByWeaponAttack?: boolean;
  discountBy?: 'boardCount'|'otherHandCards'|'missingHeroHealth';
  targetRule?: TargetRule;
  battlecry?: Effect[];
  deathrattle?: Effect[];
  startTurn?: Effect[];
  endTurn?: Effect[];
  endAnyTurn?: Effect[];
  auras?: Aura[];
  chargeAuraTribe?:Tribe;
  triggers?: Trigger[];
  choices?:CardChoice[];
}
export interface CardChoice {label:string; targetRule?:TargetRule; effects:Effect[]}
export interface Aura { target:'otherFriendlyMinions'|'adjacentFriendlyMinions'|'allOtherMinions'; attack:number; health:number; tribe?:Tribe }
export interface CostAura { kind:'spell'|'minion'|'weapon'|'any'; side:'friendly'|'both'; amount:number; tribe?:Tribe; minimum?:number; firstMinionOnly?:boolean; }
export interface Trigger { event:'friendlyMinionSummoned'|'friendlySpellCast'|'friendlySpellPlayed'|'anySpellPlayed'|'friendlyMinionDied'|'anyMinionDied'|'selfDamaged'|'anyMinionHealed'|'friendlyMinionDamaged'|'anyMinionDamaged'|'friendlyOverload'|'friendlyOverloadCardPlayed'|'anyCharacterHealed'|'anyMinionSummoned'|'friendlyCardPlayed'|'anySecretPlayed'; tribe?:Tribe; effects:Effect[] }
export interface SpellCard extends CardBase { kind: 'spell'; targetRule?: TargetRule; effects?: Effect[]; choices?:CardChoice[] }
export interface WeaponCard extends CardBase { kind: 'weapon'; attack: number; durability: number; targetRule?:TargetRule; battlecry?:Effect[]; beforeAttack?:Effect[]; secretRevealed?:Effect[]; secretRevealedSide?:'friendly'|'both'; windfury?:boolean; immuneWhileAttacking?:boolean; attackLossVsMinion?:boolean; friendlySummon?:Effect[] }
export type SecretTrigger = 'enemyAttackHero' | 'enemyAttackAny' | 'enemyMinionAttack' | 'enemyAttackFriendlyMinion' | 'enemyPlayMinion' | 'enemyCastSpell' | 'enemyTargetMinionSpell' | 'friendlyMinionDied' | 'friendlyHeroDamaged' | 'friendlyHeroLethal';
export interface SecretCard extends CardBase { kind: 'secret'; trigger: SecretTrigger; effects: Effect[]; needsBoardSpace?:boolean; needsMinionAttacker?:boolean }
export interface CoinCard {
  id: '__coin'; name: string; kind: 'coin'; cost: 0; effects: Effect[];
}
export type Card = MinionCard | SpellCard | WeaponCard | SecretCard | CoinCard;
export type Catalog = Record<string, Card>;
export interface Deck {
  heroClass: HeroClass;
  cards: string[];
}
export interface CardInstance { instanceId: string; cardId: string; costDiscount?:number }
export interface Minion extends CardInstance {
  originalOwner?: PlayerId;
  returnController?: PlayerId;
  attack: number;
  health: number;
  maxHealth: number;
  attacksRemaining: number;
  attacksMadeThisTurn?:number;
  summonedTurn?:number;
  enteredOrder?:number;
  keywords?: Keyword[];
  silenced?: boolean;
  frozenThroughTurn?: number;
  auraAttack?:number;
  auraHealth?:number;
  temporaryAttack?:number;
  immuneThisTurn?:boolean;
  auraCharge?:boolean;
  auraWindfury?:boolean;
  bonusSpellDamage?:number;
  destroyAtStartOf?:PlayerId[];
  destroyAtEndOf?:PlayerId[];
  stealthUntilStartOf?:PlayerId;
  deathrattleSummons?:string[];
  drawOnAttackOwners?:PlayerId[];
}
export interface Weapon { attack: number; auraAttack?:number; durability: number; cardId?: string }
export interface Player {
  heroClass: HeroClass;
  health: number;
  mana: number;
  maxMana: number;
  armor: number;
  heroAttack: number;
  heroAttacksRemaining: number;
  heroAttacksMadeThisTurn?:number;
  heroImmuneThisTurn?:boolean;
  shadowformLevel?:1|2;
  heroForm?:'jaraxxus';
  maxHealth?:number;
  freeSpellsNextTurn?:boolean;
  freeSpellsThisTurn?:boolean;
  nextSpellDiscount?:number;
  heroPowerUsed: boolean;
  protectMinionsThisTurn?:boolean;
  nextSecretFree?:boolean;
  nextTurnCards?:string[];
  heroFrozenThroughTurn?: number;
  pendingOverload: number;
  lockedMana: number;
  cardsPlayedThisTurn: number;
  minionsPlayedThisTurn?:number;
  weapon: Weapon | null;
  secrets: CardInstance[];
  fatigue: number;
  deck: CardInstance[];
  hand: CardInstance[];
  board: Minion[];
  mulliganDone: boolean;
}
export type Target = { kind: 'hero'; player?: PlayerId } | { kind: 'minion'; instanceId: string };
/** Optional presentation trace. Targets are already public characters, never
 * hand/deck objects. It is not stored in authoritative game state. */
export type BattleVisualEvent =
  | {kind:'damage';target:Target;side:PlayerId;amount:number;armorAbsorbed?:number}
  | {kind:'heal';target:Target;side:PlayerId;amount:number}
  | {kind:'shield'|'death'|'deathrattle';target:Target;side:PlayerId}
  | {kind:'draw';side:PlayerId;burned:boolean}
  | {kind:'fatigue';side:PlayerId;target:Target;amount:number}
  | {kind:'combat';target:Target;side:PlayerId}
  | {kind:'secretTriggered';cardId:string;side:PlayerId};
export type Action =
  | { type: 'mulligan'; replace: string[] }
  | { type: 'playCard'; instanceId: string; target?: Target; position?: number; choice?:number }
  | { type: 'attack'; attackerId: string; target: Target }
  | { type: 'heroAttack'; target: Target }
  | { type: 'heroPower'; target?: Target }
  | { type: 'endTurn' }
  | { type: 'chooseDeckCard'; instanceId:string }
  | { type: 'concede' };
export interface GameState {
  phase: 'mulligan' | 'playing' | 'finished';
  firstPlayer: PlayerId;
  activePlayer: PlayerId;
  turn: number;
  players: [Player, Player];
  winner: PlayerId | null;
  reason: 'health' | 'fatigue' | 'concede' | 'turnLimit' | null;
  catalog: Catalog;
  rng: number;
  nextId: number;
  nextEntryOrder?:number;
  revision: number;
  history: PublicEvent[];
  pendingChoice?: {owner:PlayerId;cards:CardInstance[]};
}
export interface PublicEvent {turn:number;player:PlayerId;message:string}
export interface PublicPlayer {
  heroAttacksMadeThisTurn?:number;
  heroClass: HeroClass;
  health: number;
  mana: number;
  maxMana: number;
  armor: number;
  heroAttack: number;
  heroAttacksRemaining: number;
  heroImmuneThisTurn?:boolean;
  shadowformLevel?:1|2;
  heroForm?:'jaraxxus';
  maxHealth?:number;
  freeSpellsNextTurn?:boolean;
  freeSpellsThisTurn?:boolean;
  nextSpellDiscount?:number;
  heroPowerUsed: boolean;
  protectMinionsThisTurn?:boolean;
  nextSecretFree?:boolean;
  heroFrozenThroughTurn?: number;
  pendingOverload: number;
  lockedMana: number;
  cardsPlayedThisTurn: number;
  minionsPlayedThisTurn?:number;
  weapon: Weapon | null;
  secretCount: number;
  fatigue: number;
  deckCount: number;
  handCount: number;
  board: Minion[];
  mulliganDone: boolean;
}
export interface PlayerView {
  phase: GameState['phase'];
  activePlayer: PlayerId;
  firstPlayer: PlayerId;
  turn: number;
  winner: PlayerId | null;
  reason: GameState['reason'];
  revision: number;
  history: PublicEvent[];
  choicePending?:boolean;
  self: PublicPlayer & { hand: CardInstance[]; secrets: CardInstance[]; pendingChoice?:CardInstance[] };
  opponent: PublicPlayer;
}
