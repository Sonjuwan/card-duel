import type {AccountProfile,GrowthView} from './account-protocol.ts';
import {HERO_CLASSES} from './engine/src/index.ts';
import {awardMatch,questStatus,syncOwned} from './progression.ts';

export interface GrowthMilestone {rank:number;games:number;xp:number;ownedCards:number}
export interface GrowthSimulation {winPercent:number;followQuest:boolean;games:number;wins:number;rank:number;xp:number;ownedCards:number;questCompleted:number;rank25At:number|null;allCardsAt:number|null;milestones:GrowthMilestone[]}

/** A deterministic progression accounting forecast, NOT a battle/AI-strength simulation.
 * Evenly distributes hypothetical wins, plays full eligible matches, and uses
 * the very same award function as the account backend. No storage is accessed. */
export function simulateGrowth(growth:GrowthView,winPercent:number,followQuest=true,maxGames=5000):GrowthSimulation{
  if(!Number.isInteger(winPercent)||winPercent<0||winPercent>100||!Number.isInteger(maxGames)||maxGames<1||maxGames>10000)throw new Error('Invalid growth simulation settings');
  let profile:AccountProfile=syncOwned({revision:0,decks:[],xp:0,rank:1,rankWins:0,questGames:0,ownedCards:[]},growth);
  const total=growth.starterIds.length+growth.unlocks.length,milestones:GrowthMilestone[]=[{rank:1,games:0,xp:profile.xp,ownedCards:profile.ownedCards.length}];
  let games=0,wins=0,rank25At:number|null=null,allCardsAt:number|null=profile.ownedCards.length===total?0:null;
  while(games<maxGames&&(rank25At===null||allCardsAt===null)){
    games++;
    const win=Math.floor(games*winPercent/100)>wins;if(win)wins++;
    const currentQuest=questStatus(profile.questGames).heroClass,heroClass=followQuest?currentQuest:HERO_CLASSES[(HERO_CLASSES.indexOf(currentQuest)+1)%HERO_CLASSES.length];
    const next=awardMatch(profile,growth,{matchId:`simulation-${games}`,rank:profile.rank,heroClass,outcome:win?'win':'loss',eligible:true,completedAt:games});
    if(next.rank>profile.rank)milestones.push({rank:next.rank,games,xp:next.xp,ownedCards:next.ownedCards.length});
    profile=next;
    if(rank25At===null&&profile.rank===25)rank25At=games;
    if(allCardsAt===null&&profile.ownedCards.length===total)allCardsAt=games;
    // No promotion is possible at zero wins. Stop once the reachable collection is complete.
    if(winPercent===0&&allCardsAt!==null)break;
  }
  return {winPercent,followQuest,games,wins,rank:profile.rank,xp:profile.xp,ownedCards:profile.ownedCards.length,questCompleted:questStatus(profile.questGames).completed,rank25At,allCardsAt,milestones};
}
