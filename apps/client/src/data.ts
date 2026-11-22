import { createCatalog,HERO_TOKENS } from '../../../packages/engine/src/index.ts';
import type { Catalog,HeroClass,Keyword,Tribe } from '../../../packages/engine/src/index.ts';
export let catalog:Catalog={};
export let catalogHash='';
export function loadPublicCatalog(raw:unknown,hash:string){if(!/^[a-f0-9]{64}$/.test(hash))throw new Error('카탈로그 버전 확인 실패');catalog={...createCatalog(raw),...Object.fromEntries(HERO_TOKENS.map(c=>[c.id,c]))};catalogHash=hash;}
export const className:Record<HeroClass,string>={warrior:'전사',shaman:'주술사',rogue:'도적',paladin:'성기사',hunter:'사냥꾼',druid:'드루이드',warlock:'흑마법사',mage:'마법사',priest:'사제'};
export const keywords:Record<Keyword,string>={taunt:'도발',charge:'돌진',divineShield:'천상의 보호막',windfury:'질풍',stealth:'은신',poisonous:'독성'};
export const tribes:Record<Tribe,string>={beast:'야수',demon:'악마',dragon:'용족',murloc:'멀록',pirate:'해적',totem:'토템',none:''};
export const heroPowerDescription:Record<HeroClass,string>={warrior:'방어도를 2 얻습니다.',shaman:'아직 내 전장에 없는 기본 토템 중 하나를 무작위 소환합니다.',rogue:'1/2 단검을 장착합니다.',paladin:'1/1 은빛 보병을 소환합니다.',hunter:'적 영웅에게 피해 2를 줍니다.',druid:'이번 턴 공격력 1과 방어도 1을 얻습니다.',warlock:'카드 한 장을 뽑고 내 영웅에게 피해 2를 줍니다.',mage:'캐릭터 하나에게 피해 1을 줍니다.',priest:'캐릭터 하나의 생명력을 2 회복합니다.'};
