export const QUEST_SLOTS=['basic','common','special'] as const;
export type QuestSlot=typeof QUEST_SLOTS[number];
export type QuestMetric=
  | 'games'|'heroDamage'|'minion12'|'faceAttacks'|'charge'|'earlyDamage'|'minion34'|'minion56'|'buff'|'battlecry'|'deathrattle'|'minionKills'
  | 'kills'|'spellKills'|'taunt'|'areaKills'|'draw'|'heal'|'armor'|'minion7'|'minion8'|'attack6'|'health6'|'spell7'|'discount'
  | 'spells'|'weaponAttacks'|'weaponDamage'|'power'|'shield'|'stealth'|'windfury'|'silence'|'allyDamage'|'totems'|'overload'
  | 'spellDamage'|'summons'|'combo'|'cheapCards'|'recruits'|'shieldGain'|'beasts'|'secrets'|'beastAttacks'|'minion13'|'mana'
  | 'minion6'|'choose'|'attack5'|'demons'|'selfDamage'|'freeze'|'powerDamage'|'healthBuff'|'minionHeal';
export type QuestCounters=Partial<Record<QuestMetric,number>>;
export type QuestHero=import('./engine/src/types.ts').HeroClass;
export type QuestStrategy='aggressive'|'midrange'|'defensive'|'large'|'special';
export interface QuestDefinition {
  id:string;slot:QuestSlot;hero:QuestHero|null;metric:QuestMetric;title:string;target:number;unit:string;
  difficulty:'easy'|'normal'|'hard';xp:number;strategy?:QuestStrategy;enabled:boolean;
  minKinds?:number;minCopies?:number;
}
export interface ActiveQuest {
  id:string;definitionId:string;hero:QuestHero;metric:QuestMetric;title:string;unit:string;target:number;xp:number;progress:number;
}
export interface CompletedQuest extends ActiveQuest {rewarded:true}
export interface QuestProgress {
  schema:1;basicCompleted:number;serial:number;active:Partial<Record<QuestSlot,ActiveQuest>>;
  games:Partial<Record<QuestHero,number>>;
  issued:Record<string,number>;completed:Record<string,number>;
  recent:Partial<Record<QuestSlot,{hero:QuestHero;metric:QuestMetric}>>;
}
