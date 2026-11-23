import type {AccountProfile,GrowthView,MatchAward} from '../../../packages/account-protocol.ts';
import {decodeAccountProfile} from '../../../packages/account-profile.ts';
import {awardMatch,buildGrowth,ownedDeck,rankInfo,rankedBotDeck,syncOwned} from '../../../packages/progression.ts';
import type {BotDifficulty,Catalog,Deck,HeroClass} from '../../../packages/engine/src/index.ts';
import {HERO_CLASSES} from '../../../packages/engine/src/index.ts';
import growthConfig from '../../../data/progression/online.json' with {type:'json'};
import type {LocalDuelInput} from './local-duel.ts';

export interface OfflineGrowthRecord{schema:1;profile:AccountProfile;settledMatchIds:string[]}
export interface OfflineTierContext{rank:number;deckPower:number;intelligence:BotDifficulty;opponentDeck:Deck}
export interface OfflineDeveloperContext extends OfflineTierContext{experiment?:'mixture-v1'}
export interface OfflineRankContext extends OfflineTierContext{profileRevision:number}

/** The offline release uses the same developer-tuned growth rules as the server. */
export const offlineGrowth=(catalog:Catalog)=>buildGrowth(catalog,growthConfig.cardPowerOverrides,growthConfig.rankTuning,('unlockXp' in growthConfig?growthConfig.unlockXp:undefined) as Parameters<typeof buildGrowth>[3]);

/** Presentation only. Promotion itself still happens exclusively in awardMatch
 * after an eligible win at the current rank. */
export function offlineRankProgress(profile:Pick<AccountProfile,'rank'|'rankWins'|'xp'>,growth:GrowthView){
  if(profile.rank>=growth.ranks.length)return {complete:true as const};
  const next=rankInfo(profile.rank+1,growth.ranks),requiredWins=growth.winsPerRank,targetXp=next.minimumXp??0;
  const wins=Math.max(0,Math.min(requiredWins,profile.rankWins)),xpRemaining=Math.max(0,targetXp-profile.xp),winsRemaining=requiredWins-wins;
  return {complete:false as const,next,wins,requiredWins,winsRemaining,targetXp,xpRemaining,xpBarMax:Math.max(1,targetXp),xpBarValue:targetXp===0?1:Math.max(0,Math.min(targetXp,profile.xp))};
}

export function readOfflineGrowth(raw:unknown,growth:GrowthView):OfflineGrowthRecord{
  if(raw===undefined)return {schema:1,profile:syncOwned({revision:0,decks:[],xp:0,rank:1,rankWins:0,questGames:0,ownedCards:[]},growth),settledMatchIds:[]};
  if(!raw||typeof raw!=='object')throw Error('오프라인 성장 기록이 손상되었습니다.');
  const value=raw as OfflineGrowthRecord;
  if(value.schema!==1||!Array.isArray(value.settledMatchIds)||value.settledMatchIds.some(id=>typeof id!=='string'||!id||id.length>128)||new Set(value.settledMatchIds).size!==value.settledMatchIds.length)throw Error('오프라인 성장 기록이 손상되었습니다.');
  const profile=decodeAccountProfile(value.profile);
  if(profile.recentMatches?.some(m=>!value.settledMatchIds.includes(m.matchId)))throw Error('오프라인 경기 원장이 손상되었습니다.');
  const ranked=profile.matchStats?.ranked,total=(ranked?.wins??0)+(ranked?.losses??0)+(ranked?.draws??0);
  if(profile.revision!==value.settledMatchIds.length||total!==value.settledMatchIds.length||profile.recentMatches?.some(m=>m.mode!=='ranked'))throw Error('오프라인 전적과 성장 원장이 일치하지 않습니다.');
  return {schema:1,profile:syncOwned(profile,growth),settledMatchIds:[...value.settledMatchIds]};
}

/** A backup is deliberately not an online-account import credential. A fresh
 * installation can restore it; records with existing play are never replaced. */
export type OfflineGrowthBackup={format:'card-duel-offline-growth';schema:1;exportedAt:string;record:OfflineGrowthRecord};
export function createGrowthBackup(record:OfflineGrowthRecord,growth:GrowthView,now=new Date().toISOString()):OfflineGrowthBackup{
  return {format:'card-duel-offline-growth',schema:1,exportedAt:now,record:readOfflineGrowth(record,growth)};
}
export function decodeGrowthBackup(raw:unknown,growth:GrowthView):OfflineGrowthRecord{
  if(!raw||typeof raw!=='object')throw Error('오프라인 성장 백업 파일이 아닙니다.');const backup=raw as OfflineGrowthBackup;
  if(backup.format!=='card-duel-offline-growth'||backup.schema!==1||typeof backup.exportedAt!=='string'||!Number.isFinite(Date.parse(backup.exportedAt))||!backup.record)throw Error('지원하지 않는 오프라인 성장 백업입니다.');
  return readOfflineGrowth(backup.record,growth);
}
export function canRestoreGrowth(record:OfflineGrowthRecord){const p=record.profile;return p.revision===0&&p.xp===0&&p.rank===1&&p.rankWins===0&&p.questGames===0&&p.decks.length===0&&record.settledMatchIds.length===0;}

/** A ranked player cannot change rank, opponent power, or intelligence via the
 * practice settings. Only the current owned collection may enter the match. */
export function createOfflineRankedInput(input:LocalDuelInput,record:OfflineGrowthRecord,growth:GrowthView):LocalDuelInput{
  const profile=syncOwned(record.profile,growth),tier=rankInfo(profile.rank,growth.ranks);
  ownedDeck(input.deck,input.catalog,profile);
  const test=createOfflineDeveloperInput(input,growth,tier.rank),{developerTest, ...base}=test;
  return {...base,deviceMode:'auto',ranked:{...developerTest!,profileRevision:profile.revision}};
}

/** Test mode exercises exactly the same tier opponent without granting XP. */
export function createOfflineDeveloperInput(input:LocalDuelInput,growth:GrowthView,rank:number,experiment=false):LocalDuelInput{
  if(!Number.isInteger(rank)||rank<1||rank>25)throw Error('개발자 시험 랭크는 1~25입니다.');const tier=rankInfo(rank,growth.ranks);
  const seed=input.deckSeed??((input.seed^0x9ef1672)>>>0),heroClass:HeroClass=HERO_CLASSES[(input.seed>>>0)%HERO_CLASSES.length];
  const intelligence=tier.intelligence as BotDifficulty,opponentDeck=rankedBotDeck(input.catalog,growth,heroClass,tier.deckPower,seed);
  const style=tier.deckPower<6?'starter':tier.deckPower<13?'practice':tier.deckPower<19?'synergy':'legendary';
  const {ranked:_,developerTest:__,...base}=input;
  return {...base,heroClass,difficulty:intelligence,style,firstPlayer:undefined,deckSeed:seed,developerTest:{rank:tier.rank,deckPower:tier.deckPower,intelligence,opponentDeck,...(experiment?{experiment:'mixture-v1' as const}:{})}};
}

/** Ledger IDs outlive the 30 displayed match records. A stale tab cannot
 * settle a different game against a newer profile revision. */
export function settleOfflineRanked(record:OfflineGrowthRecord,growth:GrowthView,context:OfflineRankContext,award:MatchAward):OfflineGrowthRecord{
  if(record.settledMatchIds.includes(award.matchId))return record;
  if(context.profileRevision!==record.profile.revision||context.rank!==record.profile.rank||award.rank!==context.rank||award.mode!=='ranked')throw Error('다른 경기에서 성장 기록이 변경되었습니다.');
  const profile=decodeAccountProfile({...awardMatch(record.profile,growth,award),revision:record.profile.revision+1});
  return {schema:1,profile,settledMatchIds:[...record.settledMatchIds,award.matchId]};
}
