import type { Catalog, Deck, HeroClass } from './types.ts';
import { deckCards, repairDeck } from './decks.ts';
import { validateDeck } from './engine.ts';
import { RULES, requireRule,maxCardCopies } from './rules.ts';

// Human-facing starter decks, separate from the existing bot deck generator.
// Two copies of each of 15 cards, with inexpensive minions, removal, and a few
// finishers. These are accessible practice decks, not competitive guarantees.
const PRESETS:Record<HeroClass,readonly string[]>={
  warrior:['iron_axe','blood_veteran','test_of_steel','harsh_overseer','shield_wall','vanguard_elite','mortal_blow','great_waraxe','recruit','plague_gnome','river_lizard','harvest_golem','snow_brute','pain_scholar','ogre'],
  shaman:['lightning_debt','stone_edge','ember_totem','storm_elemental','spirit_pack','toad_curse','thunderstorm','flame_spirit','recruit','silver_squire','river_lizard','pack_wolf','harvest_golem','snow_brute','port_guard'],
  rogue:['precise_stab','weapon_hone','twin_strike','needle_cut','bandit_leader','shadow_duelist','ambush_dagger','silent_execution','recruit','plague_gnome','river_lizard','blood_raider','harvest_golem','snow_brute','ogre'],
  paladin:['light_guard','valor_blessing','noble_sacrifice','silver_protector','peacekeeper','healing_hammer','hallowed_ground','sovereign_blessing','silver_squire','recruit','river_lizard','pack_wolf','harvest_golem','snow_brute','silver_knight'],
  hunter:['arcane_arrow','forest_wolf','wild_tracker','fire_trap','companion_call','wild_arrow','beast_tamer','highmane','night_cat','river_lizard','wolf','boar_trapper','harvest_golem','snow_brute','jungle_tiger'],
  druid:['thorn_claw','root_bloom','nature_choice','wild_mark','ancient_warden','raking_storm','shape_guardian','ironwood_guardian','recruit','silver_squire','river_lizard','wolf','harvest_golem','snow_brute','ogre'],
  warlock:['imp_scout','void_sentinel','life_thread','infernal_fire','shadow_lance','life_siphon','infernal_blast','soul_drain','recruit','plague_gnome','river_lizard','wolf','harvest_golem','snow_brute','ogre'],
  mage:['mana_wyrm','starlight_barrage','ice_shard','spell_tutor','arcane_notes','flame_sphere','sheep_hex','flame_tide','recruit','silver_squire','river_lizard','harvest_golem','snow_brute','cave_mage','ogre'],
  priest:['healing_scholar','sacred_spark','life_barrier','weakpoint_sentence','giant_sentence','radiant_wave','temple_guardian','holy_flame','recruit','river_lizard','wolf','injured_sword','harvest_golem','snow_brute','ogre'],
};

/** Fill only unoccupied slots, never discard or reorder a player's cards.
 * If a balance version lacks preset cards, fill with legal available cards. */
export function completePracticeDeck(catalog:Catalog,partial:Deck):Deck {
  const {deck,discarded}=repairDeck(catalog,partial);
  requireRule(!discarded.length,'덱에서 사용할 수 없는 카드를 먼저 제거하세요.');
  const pool=deckCards(catalog,deck.heroClass),preferred=new Set(PRESETS[deck.heroClass]);
  const counts=new Map<string,number>(),curve=Array<number>(7).fill(0),targets=[0,6,8,6,4,2,4];
  let minions=0;
  const count=(id:string)=>{const c=catalog[id];counts.set(id,(counts.get(id)??0)+1);curve[Math.min(6,c.cost)]++;if(c.kind==='minion')minions++;};
  for(const id of deck.cards)count(id);
  while(deck.cards.length<RULES.deckSize){
    let best:typeof pool[number]|undefined,bestScore=-Infinity;
    for(const c of pool){const copies=counts.get(c.id)??0;if(copies>=maxCardCopies(c))continue;
      const bucket=Math.min(6,c.cost);
      const score=(preferred.has(c.id)?100:0)+3*(targets[bucket]-curve[bucket])+(c.kind==='minion'&&minions<16?10:0)+(c.class===deck.heroClass?2:0)+(c.rarity==='basic'?1:0)-copies*2-c.cost*0.1-(c.kind==='minion'&&c.noAttack?50:0);
      if(score>bestScore){best=c;bestScore=score;}
    }
    requireRule(best,'현재 카드 목록으로 30장 덱을 완성할 수 없습니다.');
    deck.cards.push(best.id);count(best.id);
  }
  validateDeck(deck,catalog);return deck;
}

export function practiceDeck(catalog:Catalog,heroClass:HeroClass):Deck{return completePracticeDeck(catalog,{heroClass,cards:[]});}

/** A legal, familiar practice deck with two finishers, if the catalog offers
 * them. Older snapshots continue to work; human presets remain unchanged. */
export function legendaryPracticeDeck(catalog:Catalog,heroClass:HeroClass):Deck {
  const pool=deckCards(catalog,heroClass);
  const signature=pool.find(c=>c.class===heroClass&&c.rarity==='legendary');
  const neutral=pool.find(c=>c.id==='cairne_bloodhoof'&&c.rarity==='legendary')??pool.find(c=>c.class==='neutral'&&c.rarity==='legendary');
  return completePracticeDeck(catalog,{heroClass,cards:[signature,neutral].filter(c=>c!==undefined).map(c=>c.id)});
}
