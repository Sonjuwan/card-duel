import type {AccountProfile} from './account-protocol.ts';
import {validCareer,validLevelUps} from './career.ts';
import {rewardPathId} from './reward-road.ts';

const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
const string=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
const ids=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(string);

/** Persisted progress is not a deck legality check: historical card and class
 * IDs must survive later catalog patches. Only the storage format is checked.
 * A pre-progression v0.46 profile may lack rankWins; no other wrong value is
 * replaced by a default. Database revision columns are authoritative. */
export function decodeAccountProfile(input:unknown,options:{revision?:number;legacyRankWins?:boolean}={}):AccountProfile{
  const invalid=()=>{throw Error('Invalid account profile');};
  if(!record(input))return invalid();
  const p:Record<string,unknown>={...input,revision:options.revision??input.revision,rankWins:options.legacyRankWins&&input.rankWins===undefined?0:input.rankWins};
  if(!integer(p.revision)||!integer(p.xp)||!integer(p.rank,1,25)||!integer(p.rankWins,0,3)||!integer(p.questGames)||!ids(p.ownedCards)||new Set(p.ownedCards).size!==p.ownedCards.length||!Array.isArray(p.decks)||p.decks.length>20)return invalid();
  if(p.rewardRoad!==undefined){
    const road=p.rewardRoad;
    if(!record(road)||!rewardPathId(road.selectedPathId)||!record(road.paths)||!Object.hasOwn(road.paths,road.selectedPathId))return invalid();
    for(const [id,progress] of Object.entries(road.paths)){
      if(!rewardPathId(id)||!record(progress)||!integer(progress.xp,0,p.xp as number)||typeof progress.complete!=='boolean')return invalid();
    }
  }
  const names=new Set<string>();
  for(const item of p.decks){
    if(!record(item)||!string(item.name)||item.name.trim()!==item.name||item.name.length>40||names.has(item.name)||!record(item.deck)||!string(item.deck.heroClass)||!ids(item.deck.cards))return invalid();
    names.add(item.name);
  }
  if(p.career!==undefined&&!validCareer(p.career))return invalid();
  if(p.matchStats!==undefined){
    if(!record(p.matchStats))return invalid();
    for(const mode of ['ranked','pvp']){const stats=p.matchStats[mode];if(!record(stats)||!integer(stats.wins)||!integer(stats.losses)||!integer(stats.draws))return invalid();}
  }
  if(p.recentMatches!==undefined){
    if(!Array.isArray(p.recentMatches)||p.recentMatches.length>30)return invalid();
    const seen=new Set<string>();
    for(const m of p.recentMatches){
      if(!record(m)||!string(m.matchId)||seen.has(m.matchId)||(m.mode!=='ranked'&&m.mode!=='pvp')||(m.outcome!=='win'&&m.outcome!=='loss'&&m.outcome!=='draw')||!integer(m.rank,m.mode==='ranked'?1:0,m.mode==='ranked'?25:0)||!string(m.heroClass)||m.opponentClass!==undefined&&!string(m.opponentClass)||!integer(m.completedAt)||!integer(m.xp)||typeof m.questAdvanced!=='boolean'||typeof m.eligible!=='boolean'||m.turns!==undefined&&!integer(m.turns)||m.questCompleted!==undefined&&typeof m.questCompleted!=='boolean'||m.questBonusXp!==undefined&&!integer(m.questBonusXp)||m.unlockedCards!==undefined&&!ids(m.unlockedCards)||m.rankAfter!==undefined&&!integer(m.rankAfter,1,25))return invalid();
      if(m.levelUps!==undefined&&(!m.eligible||!validLevelUps(m.levelUps)))return invalid();
      if(m.matchXp!==undefined&&(!integer(m.matchXp)||Number(m.matchXp)+Number(m.questBonusXp??0)!==m.xp))return invalid();
      if(m.completedQuests!==undefined){
        if(!Array.isArray(m.completedQuests)||m.completedQuests.length>3)return invalid();
        const ids=new Set<string>();let xp=0;
        for(const q of m.completedQuests){
          if(!record(q)||typeof q.id!=='string'||!/^quest-[1-9]\d*$/.test(q.id)||ids.has(q.id)||q.hero!==m.heroClass||
            !string(q.title)||q.title.length>160||!string(q.definitionId)||!string(q.metric)||!string(q.unit)||
            !integer(q.target,1,100000)||q.progress!==q.target||!integer(q.xp,0,100000)||q.rewarded!==true)return invalid();
          ids.add(q.id);xp+=Number(q.xp);
        }
        if(xp!==Number(m.questBonusXp??0))return invalid();
      }
      seen.add(m.matchId);
    }
  }
  return p as unknown as AccountProfile;
}
