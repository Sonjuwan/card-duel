import settings from '../data/progression/levels.json' with {type:'json'};
import type {AccountProfile,MatchHistoryEntry,MatchStats} from './account-protocol.ts';
import {HERO_CLASSES} from './engine/src/rules.ts';
import type {HeroClass} from './engine/src/types.ts';

export interface HeroCareer extends MatchStats {xp:number;streak:number;bestStreak:number;quests:number}
export interface Career {schema:1;record:MatchStats;heroes:Partial<Record<HeroClass,HeroCareer>>}
export interface LevelChange {before:number;after:number}
export interface LevelUps {account?:LevelChange;hero?:(LevelChange&{hero:HeroClass})}

export const emptyRecord=():MatchStats=>({wins:0,losses:0,draws:0});
export const emptyHeroCareer=():HeroCareer=>({...emptyRecord(),xp:0,streak:0,bestStreak:0,quests:0});

export function levelProgress(xp:number,kind:'account'|'hero'){
  const {base,step}=settings[kind];
  const threshold=(level:number)=>(level-1)*(base+step*(level-2)/2);
  let low=1,high=2;
  while(threshold(high)<=xp)high*=2;
  while(high-low>1){
    const middle=Math.floor((low+high)/2);
    if(threshold(middle)<=xp)low=middle;
    else high=middle;
  }
  const minimum=threshold(low),next=threshold(low+1);
  return {level:low,progress:xp-minimum,required:next-minimum,remaining:next-xp};
}

export function masteryTier(xp:number){
  const {level}=levelProgress(xp,'hero');
  return settings.mastery.filter(minimum=>level>=minimum).length-1;
}
export const totalMatches=({wins,losses,draws}:MatchStats)=>wins+losses+draws;
export const winPercentage=({wins,losses,draws}:MatchStats)=>wins+losses+draws?Math.round(100*wins/(wins+losses+draws)):null;
const knownHero=(hero:unknown):hero is HeroClass=>HERO_CLASSES.includes(hero as HeroClass);

export function advanceCareer(career:Career,receipt:MatchHistoryEntry):Career{
  if(!receipt.eligible)return career;
  const field=receipt.outcome==='win'?'wins':receipt.outcome==='loss'?'losses':'draws';
  const record={...career.record,[field]:career.record[field]+1};
  const heroes={...career.heroes};
  const get=(hero:HeroClass)=>heroes[hero]??emptyHeroCareer();
  if(knownHero(receipt.heroClass)){
    const hero=get(receipt.heroClass);
    const streak=receipt.outcome==='win'?hero.streak+1:0;
    heroes[receipt.heroClass]={...hero,[field]:hero[field]+1,streak,bestStreak:Math.max(streak,hero.bestStreak),xp:hero.xp+(receipt.completedQuests?receipt.matchXp??receipt.xp-(receipt.questBonusXp??0):receipt.xp),quests:hero.quests+(!receipt.completedQuests&&receipt.questCompleted?1:0)};
  }
  for(const quest of receipt.completedQuests??[]){
    if(!knownHero(quest.hero))continue;
    const hero=get(quest.hero);
    heroes[quest.hero]={...hero,xp:hero.xp+quest.xp,quests:hero.quests+1};
  }
  return {schema:1,record,heroes};
}

export function careerOf(profile:AccountProfile):Career{
  if(profile.career)return profile.career;
  const chronological=[...(profile.recentMatches??[])].reverse().sort((a,b)=>a.completedAt-b.completedAt);
  return chronological.reduce(advanceCareer,{schema:1,record:emptyRecord(),heroes:{}});
}

export function levelUpsFor(before:AccountProfile,after:AccountProfile,hero:HeroClass):LevelUps{
  const accountBefore=levelProgress(before.xp,'account').level,accountAfter=levelProgress(after.xp,'account').level;
  const heroBefore=levelProgress(careerOf(before).heroes[hero]?.xp??0,'hero').level,heroAfter=levelProgress(careerOf(after).heroes[hero]?.xp??0,'hero').level;
  return {
    ...(accountAfter>accountBefore?{account:{before:accountBefore,after:accountAfter}}:{}),
    ...(heroAfter>heroBefore?{hero:{hero,before:heroBefore,after:heroAfter}}:{})
  };
}

const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const validStats=(stats:unknown):stats is Record<string,unknown>&MatchStats=>record(stats)&&count(stats.wins)&&count(stats.losses)&&count(stats.draws);
export function validCareer(value:unknown):value is Career{
  if(!record(value)||value.schema!==1||!validStats(value.record)||!record(value.heroes))return false;
  let wins=0,losses=0,draws=0;
  for(const [hero,stats] of Object.entries(value.heroes)){
    if(!validStats(stats)||!knownHero(hero)||!count(stats.xp)||!count(stats.quests)||!count(stats.streak)||!count(stats.bestStreak)||stats.streak>stats.bestStreak||stats.bestStreak>stats.wins)return false;
    wins+=stats.wins;losses+=stats.losses;draws+=stats.draws;
  }
  return wins<=value.record.wins&&losses<=value.record.losses&&draws<=value.record.draws;
}
export function validLevelUps(value:unknown):value is LevelUps{
  if(!record(value))return false;
  const validChange=(change:unknown)=>record(change)&&count(change.before)&&count(change.after)&&change.before>=1&&change.after>change.before;
  return (value.account===undefined||validChange(value.account))&&(value.hero===undefined||record(value.hero)&&knownHero(value.hero.hero)&&validChange(value.hero));
}
