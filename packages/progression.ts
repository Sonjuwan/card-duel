import {HERO_CLASSES,practiceDeck,strategicDeck,validateDeck,deckCards,maxCardCopies} from './engine/src/index.ts';
import type {Catalog,Deck,HeroClass} from './engine/src/index.ts';
import {creditRewardPath,rewardPaths,syncRewardRoad} from './reward-road.ts';
import {buildRewardPaths,DEFAULT_REWARD_PATHS} from './reward-path-config.ts';
import type {RewardPathDefinition} from './reward-path-config.ts';
import type {Card} from './engine/src/index.ts';
import type {AccountProfile,CardUnlock,GrowthView,MatchAward,RankInfo} from './account-protocol.ts';

export const QUEST_LENGTH=10;
export const WINS_PER_RANK=3;
const leagues=['브론즈','실버','골드','플래티넘','다이아몬드'];
export const RANKS:RankInfo[]=Array.from({length:25},(_,i)=>({rank:i+1,league:leagues[Math.floor(i/5)],division:5-i%5,name:`${leagues[Math.floor(i/5)]} ${5-i%5}`,deckPower:i+1,intelligence:i+1}));
export const rankInfo=(rank:number,ranks:readonly RankInfo[]=RANKS)=>ranks[Math.max(0,Math.min(24,Math.floor(rank)-1))];
export type RankTuning={deckPower:number;intelligence:number};
export type UnlockXp={base:number;perPower:number};
// Provisional progression pacing, intentionally independent from card balance.
export const DEFAULT_UNLOCK_XP:UnlockXp={base:8,perPower:3};
export const questStatus=(total:number)=>({heroClass:HERO_CLASSES[Math.floor(total/QUEST_LENGTH)%HERO_CLASSES.length],games:total%QUEST_LENGTH,completed:Math.floor(total/QUEST_LENGTH)});
export function rankedXpReward(rank:number,outcome:MatchAward['outcome']){const base=20+Math.max(1,Math.min(25,rank))*10;return outcome==='win'?base:outcome==='draw'?Math.floor(base*.7):Math.floor(base*.5);}
export const rankedQuestBonus=(rank:number)=>100+Math.max(1,Math.min(25,rank))*10;

// Preserve the pre-patch XP cadence and rank XP thresholds independently of
// the card set ordering and the player's collection.
function legacyUnlocks(catalog:Catalog,collectible:Exclude<Card,{kind:'coin'}>[],overrides:Readonly<Record<string,number>>,unlockXp:Readonly<UnlockXp>){
  const starter=new Set<string>(HERO_CLASSES.flatMap(hero=>practiceDeck(catalog,hero).cards));
  for(const [id,power] of Object.entries(overrides))if(power===1)starter.add(id);
  const remaining=collectible.filter(c=>!starter.has(c.id));
  const score=(c:typeof remaining[number])=>c.cost*3+(c.kind==='minion'?(c.attack+c.health)/2:c.kind==='weapon'?c.attack*c.durability:2);
  remaining.sort((a,b)=>score(a)-score(b)||(a.id<b.id?-1:a.id>b.id?1:0));
  const unlocks:CardUnlock[]=remaining.map((c,i)=>({cardId:c.id,power:overrides[c.id]??2+Math.floor(i*24/Math.max(1,remaining.length)),xp:0}));
  unlocks.sort((a,b)=>a.power-b.power);
  let xp=0;for(const item of unlocks){xp+=unlockXp.base+item.power*unlockXp.perPower;item.xp=xp;}
  return unlocks;
}

export function buildGrowth(catalog:Catalog,overrides:Readonly<Record<string,number>>={},rankTuning:Readonly<Record<string,RankTuning>>={},unlockXp:Readonly<UnlockXp>=DEFAULT_UNLOCK_XP,definitions:readonly RewardPathDefinition[]=DEFAULT_REWARD_PATHS):GrowthView{
  if(![unlockXp.base,unlockXp.perPower].every(v=>Number.isInteger(v)&&v>=1&&v<=1000))throw new Error('Invalid unlock XP costs');
  const collectible=Object.values(catalog).filter((c):c is Exclude<Card,{kind:'coin'}>=>c.kind!=='coin'&&c.collectible!==false);
  const starter=new Set(collectible.filter(c=>c.rarity==='basic').map(c=>c.id));
  for(const [id,power] of Object.entries(overrides)){
    if(!collectible.some(c=>c.id===id)||!Number.isInteger(power)||power<1||power>25||starter.has(id)&&power!==1)throw new Error(`Invalid card power override: ${id}`);
    if(power===1)starter.add(id);
  }
  const legacy=legacyUnlocks(catalog,collectible,overrides,unlockXp);
  const paths=buildRewardPaths(collectible,starter,legacy,power=>unlockXp.base+power*unlockXp.perPower,overrides,definitions);
  for(const [rank,tuning] of Object.entries(rankTuning))if(!/^(?:[1-9]|1[0-9]|2[0-5])$/.test(rank)||!tuning||![tuning.deckPower,tuning.intelligence].every(v=>Number.isInteger(v)&&v>=1&&v<=25))throw new Error(`Invalid rank tuning: ${rank}`);
  let minimumXp=0;
  const ranks=RANKS.map(r=>{const tuning=rankTuning[String(r.rank)],tier=tuning?{...r,...tuning}:{...r};
    // A player needs at least one card at the next opponent's assigned power,
    // or the full lower tier when that exact power has no collectible cards.
    const target=tier.deckPower===1?0:legacy.find(c=>c.power===tier.deckPower)?.xp??legacy.filter(c=>c.power<tier.deckPower).at(-1)?.xp??0;
    minimumXp=r.rank===1?0:Math.max(minimumXp,target);return {...tier,minimumXp};});
  return {ranks,unlocks:paths[0].unlocks,rewardPaths:paths,starterIds:[...starter].sort(),questOrder:[...HERO_CLASSES],questLength:QUEST_LENGTH,winsPerRank:WINS_PER_RANK};
}
export function syncOwned(profile:AccountProfile,growth:GrowthView):AccountProfile{
  return syncRewardRoad({...profile,rankWins:profile.rankWins??0},growth);
}
export function ownedDeck(deck:Deck,catalog:Catalog,profile:AccountProfile){
  validateDeck(deck,catalog);const owned=new Set(profile.ownedCards);
  if(deck.cards.some(id=>!owned.has(id)))throw new Error('아직 얻지 못한 카드가 덱에 있습니다.');
}
export function rankedBotDeck(catalog:Catalog,growth:GrowthView,heroClass:HeroClass,power:number,seed:number):Deck{
  const owned=new Set([...growth.starterIds,...rewardPaths(growth).flatMap(path=>path.unlocks).filter(c=>c.power<=power).map(c=>c.cardId)]);
  return powerDeck(catalog,growth,heroClass,power,seed,owned);
}
/** Player recommendations use exactly the server-owned IDs, not all cards in a
 * reached power tier. Patch-granted ownership is respected even if XP is lower. */
export function recommendedOwnedDeck(catalog:Catalog,growth:GrowthView,heroClass:HeroClass,profile:AccountProfile,seed:number):Deck{
  const owned=new Set(profile.ownedCards),power=rewardPaths(growth).flatMap(path=>path.unlocks).reduce((top,card)=>owned.has(card.cardId)?Math.max(top,card.power):top,1);
  if(!growth.starterIds.every(id=>owned.has(id)))throw new Error('먼저 최신 계정 카드 정보를 동기화하세요.');
  const deck=powerDeck(catalog,growth,heroClass,power,seed,owned);ownedDeck(deck,catalog,profile);return deck;
}
export function deckPowerTotal(deck:Deck,growth:GrowthView):number{const powers=new Map(rewardPaths(growth).flatMap(path=>path.unlocks).map(card=>[card.cardId,card.power]));return deck.cards.reduce((sum,id)=>sum+(powers.get(id)??1),0);}
function powerDeck(catalog:Catalog,growth:GrowthView,heroClass:HeroClass,power:number,seed:number,owned:ReadonlySet<string>):Deck{
  const pool:Catalog=Object.fromEntries(Object.entries(catalog).filter(([id,c])=>c.kind==='coin'||c.collectible===false||owned.has(id)));
  const starter=new Set(growth.starterIds),starterPool:Catalog=Object.fromEntries(Object.entries(catalog).filter(([id,c])=>c.kind==='coin'||c.collectible===false||starter.has(id)));
  const deck=strategicDeck(starterPool,heroClass,'starter',seed);
  // An unlocked pool alone may still yield the same practice deck at many ranks.
  // Progressively replace lower-power slots with available higher-power cards of
  // similar mana cost/kind. This is a provisional deck-power policy, not tuning.
  const powers=new Map(rewardPaths(growth).flatMap(path=>path.unlocks).map(c=>[c.cardId,c.power]));const cardPower=(id:string)=>powers.get(id)??1;
  const candidates=deckCards(pool,heroClass).sort((a,b)=>cardPower(b.id)-cardPower(a.id)||a.cost-b.cost||a.id.localeCompare(b.id));
  const counts=new Map<string,number>();for(const id of deck.cards)counts.set(id,(counts.get(id)??0)+1);
  const initialCosts=deck.cards.map(id=>catalog[id].cost);
  // Apply each unlocked tier incrementally: numeric power cannot go backwards
  // when difficulty rises. Keep slots close to the initial mana curve, with one
  // extra mana of latitude for late-stage finishers.
  for(let tier=2;tier<=power;tier++){
    let upgrades=tier>=12?2:1;
    while(upgrades-->0){
      let selected:{id:string;slot:number}|undefined;
      for(const next of candidates){if(cardPower(next.id)>tier||(counts.get(next.id)??0)>=maxCardCopies(next))continue;
        const slots=deck.cards.map((id,i)=>({id,i})).filter(slot=>cardPower(next.id)>cardPower(slot.id)&&pool[slot.id].kind===next.kind&&Math.abs(next.cost-initialCosts[slot.i])<=(tier>=19?3:2)).sort((a,b)=>cardPower(a.id)-cardPower(b.id)||Math.abs(next.cost-initialCosts[a.i])-Math.abs(next.cost-initialCosts[b.i])||a.i-b.i);
        if(slots.length){selected={id:next.id,slot:slots[0].i};break;}
      }
      if(!selected)break;const old=deck.cards[selected.slot];deck.cards[selected.slot]=selected.id;counts.set(old,counts.get(old)!-1);counts.set(selected.id,(counts.get(selected.id)??0)+1);
    }
  }
  validateDeck(deck,catalog);return deck;
}
/** Deployment and developer preflight use the actual ranked deck generation path. */
export function verifyRankedDecks(catalog:Catalog,growth:GrowthView):number{
  let checked=0;
  for(const rank of growth.ranks)for(const hero of HERO_CLASSES){validateDeck(rankedBotDeck(catalog,growth,hero,rank.deckPower,123),catalog);checked++;}
  return checked;
}
export function awardMatch(profile:AccountProfile,growth:GrowthView,match:MatchAward):AccountProfile{
  const current=syncOwned(profile,growth),mode=match.mode??'ranked';
  const stats=structuredClone(current.matchStats??{ranked:{wins:0,losses:0,draws:0},pvp:{wins:0,losses:0,draws:0}});
  stats[mode][match.outcome==='win'?'wins':match.outcome==='loss'?'losses':'draws']++;
  const finish=(next:AccountProfile,questBonusXp=0)=>{const before=new Set(current.ownedCards),questAdvanced=next.questGames>current.questGames;const recent=[{matchId:match.matchId,mode,rank:match.rank,heroClass:match.heroClass,opponentClass:match.opponentClass,outcome:match.outcome,completedAt:match.completedAt??Date.now(),turns:match.turns,xp:next.xp-current.xp,questAdvanced,questCompleted:questAdvanced&&next.questGames%growth.questLength===0,questBonusXp,unlockedCards:next.ownedCards.filter(id=>!before.has(id)),rankAfter:next.rank,eligible:match.eligible},...(current.recentMatches??[])].sort((a,b)=>b.completedAt-a.completedAt).slice(0,30);return {...next,recentMatches:recent,matchStats:stats};};
  if(!match.eligible||mode==='pvp')return finish(current);
  const rank=Math.max(1,Math.min(25,match.rank));
  let xp=current.xp+rankedXpReward(rank,match.outcome);
  let questGames=current.questGames,questBonusXp=0;
  if(questStatus(questGames).heroClass===match.heroClass){questGames++;if(questGames%QUEST_LENGTH===0){questBonusXp=rankedQuestBonus(rank);xp+=questBonusXp;}}
  let nextRank=current.rank,rankWins=current.rankWins;
  if(match.outcome==='win'&&rank===current.rank&&nextRank<25){rankWins=Math.min(WINS_PER_RANK,rankWins+1);if(rankWins>=WINS_PER_RANK&&xp>=(rankInfo(nextRank+1,growth.ranks).minimumXp??0)){nextRank++;rankWins=0;}}
  return finish(creditRewardPath({...current,xp,questGames,rank:nextRank,rankWins},growth,xp-current.xp),questBonusXp);
}
