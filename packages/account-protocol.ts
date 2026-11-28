import type { Deck } from './engine/src/types.ts';

export type AccountRole = 'player' | 'developer';
/** Private, credential-free description of the account's published active room. */
export interface AccountActiveRoom {mode:'ranked'|'developer-test'|'pvp';status:'waiting'|'playing';connected:boolean;rank?:number;resumeAllowed:boolean}
export interface AccountDeck { name: string; deck: Deck }
/** Compare only the selected saved deck, not the whole account revision. */
export interface AccountDeckMutation {name:string;expected:Deck|null;deck:Deck|null}
export interface AccountProfile {
  revision: number;
  decks: AccountDeck[];
  xp: number;
  rank: number;
  rankWins: number;
  questGames: number;
  ownedCards: string[];
  rewardRoad?: RewardRoadProgress;
  /** Optional for accounts created before match history was introduced. */
  recentMatches?: MatchHistoryEntry[];
  matchStats?: {ranked:MatchStats;pvp:MatchStats};
}
export interface MatchStats {wins:number;losses:number;draws:number}
export interface RankedRewardSummary {xp:number;questAdvanced:boolean;questCompleted?:boolean;questBonusXp?:number;unlockedCards?:string[];rankAfter?:number}
export interface MatchHistoryEntry extends RankedRewardSummary {matchId:string;mode:'ranked'|'pvp';rank:number;heroClass:Deck['heroClass'];opponentClass?:Deck['heroClass'];outcome:'win'|'loss'|'draw';completedAt:number;turns?:number;eligible:boolean}
export interface AccountView {
  id: string;
  email: string;
  role: AccountRole;
  profile: AccountProfile;
}
/** Provider accepted signup but has not issued an authenticated session. */
export interface AccountRegistrationPending {verificationRequired:true}
/** Downloadable local record only; intentionally has no import API. */
export interface AccountExport {schemaVersion:1;gameVersion:string;exportedAt:string;profile:AccountProfile}
export interface DeveloperRuntimeStatus {rooms:{total:number;playing:number;waiting:number;finished:number;account:number;accountPlaying:number;accountWaiting:number;ai:number};connectedSockets:number;pendingRoomWrites:number;failedRoomWrites:number;pendingResults:number;pendingCredentialChanges:number;pendingDeckChanges:number;uptimeSeconds:number;rssBytes:number;maintenance:boolean;maintenanceSaving:boolean;maintenanceSaved:boolean;readyForPatch:boolean;aiWorker?:{active:number;queued:number;capacity:number}}
export interface DeveloperStatus {role:'developer';version:string;collectible:number;rankCount:number;growthHash?:string;runtime?:DeveloperRuntimeStatus;aiModel?:{source:'local'|'release'|'default';catalogHash:string;games:number;promotions:number}}
export interface DeckUpdate { revision: number; decks: AccountDeck[] }
export interface RankInfo { rank:number; league:string; division:number; name:string; deckPower:number; intelligence:number;minimumXp?:number }
export interface CardUnlock { cardId:string; power:number; xp:number }
export interface RewardPath {
  id: string;
  name: string;
  cardIds: string[];
  unlocks: CardUnlock[];
  afterCompletion: 'accumulate' | 'cap';
}
export interface RewardRoadProgress {
  selectedPathId: string;
  paths: Record<string,{xp:number;complete:boolean}>;
}
export interface GrowthView { ranks:RankInfo[]; unlocks:CardUnlock[]; starterIds:string[]; questOrder:string[]; questLength:number; winsPerRank:number; rewardPaths?:RewardPath[] }
export interface MatchAward { matchId:string; rank:number; heroClass:Deck['heroClass']; outcome:'win'|'loss'|'draw'; eligible:boolean;mode?:'ranked'|'pvp';completedAt?:number;turns?:number;opponentClass?:Deck['heroClass'] }
