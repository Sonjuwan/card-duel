import type {Card,HeroClass} from '../../../packages/engine/src/index.ts';

export const ART_SUBJECTS=['knight','mage','rogue','priest','archer','brute','dwarf','pirate','demon','wolf','cat','bear','boar','bird','snake','turtle','sheep','fishfolk','dragon','golem','totem','spirit','plant','slime','beast','fire','ice','lightning','holy','nature','shadow','arcane','shield','sword','axe','dagger','bow','hammer','book','coin','trap','eye','storm','arrow','blood','raptor','undead','rhino','crocodile','ape','portal','fireball','frog'] as const;
export type ArtSubject=typeof ART_SUBJECTS[number];
export type ArtTheme='ember'|'forest'|'frost'|'gold'|'abyss'|'steel'|'ocean'|'violet'|'earth';
export interface ArtRecipe{subject:ArtSubject;theme:ArtTheme;seed:number;variant:number;hero?:boolean}
export const ART_PALETTES:Readonly<Record<ArtTheme,readonly [string,string,string,string,string]>>={
  ember:['#271422','#853f29','#f0a246','#f8dfa1','#9e453c'],
  forest:['#102a27','#366443','#89ba70','#dfedb0','#547f60'],
  frost:['#15243f','#385c82','#a6dcf4','#ecf9ff','#557ea5'],
  gold:['#3c2633','#996835','#e9c86b','#fff1cb','#996149'],
  abyss:['#23162e','#573a68','#b779d0','#eee1ff','#7b478a'],
  steel:['#1a2734','#586777','#a4c0c5','#f7e9d0','#64717f'],
  ocean:['#112e40','#236c77','#69c9bd','#c8f5df','#318ea0'],
  violet:['#1d234c','#534a92','#9da1fa','#efebfb','#6656ad'],
  earth:['#32282a','#856044','#cf9a63','#eee0b7','#a17c50'],
};
const CLASS_THEME:Record<HeroClass|'neutral',ArtTheme>={warrior:'ember',shaman:'ocean',rogue:'steel',paladin:'gold',hunter:'forest',druid:'forest',warlock:'abyss',mage:'violet',priest:'gold',neutral:'earth'};
const CLASS_SUBJECT:Record<HeroClass,ArtSubject>={warrior:'knight',shaman:'mage',rogue:'rogue',paladin:'knight',hunter:'archer',druid:'priest',warlock:'demon',mage:'mage',priest:'priest'};
const POWER_SUBJECT:Record<HeroClass,ArtSubject>={warrior:'shield',shaman:'totem',rogue:'dagger',paladin:'knight',hunter:'arrow',druid:'nature',warlock:'book',mage:'fire',priest:'holy'};
// A few old development names differ from the historical display name.
// Correct their visual subjects explicitly rather than drawing the literal id.
export const ART_OVERRIDES:Readonly<Record<string,readonly [ArtSubject,ArtTheme]>>={
  wolf:['raptor','ember'],night_cat:['wolf','steel'],crystal_sentinel:['knight','gold'],
  battle_watcher:['undead','abyss'],rust_collector:['slime','forest'],wild_tracker:['bird','earth'],
  glacial_construct:['spirit','frost'],crown_sentinel:['knight','gold'],toad_token:['frog','ocean'],
  tundra_beast:['rhino','frost'],river_lizard:['crocodile','ocean'],silver_gorilla:['ape','steel'],
  boar_trapper:['archer','forest'],clockwork_token:['dragon','steel'],tree_spirit:['plant','forest'],
  demon_gate:['portal','abyss'],light_well:['holy','gold'],raging_wolf:['wolf','ember'],
  stampede_kodo:['rhino','earth'],frenzy_fighter:['brute','ember'],harsh_overseer:['brute','ember'],
  shape_guardian:['bear','forest'],claw_form:['cat','forest'],guard_form:['bear','forest'],
  snow_brute:['brute','frost'],cave_mage:['brute','violet'],abomination:['undead','forest'],
  war_smith:['knight','steel'],boar_token:['boar','earth'],flame_sphere:['fireball','ember'],
  soul_flame:['fireball','abyss'],ice_shard:['ice','frost'],sheep_hex:['sheep','violet'],
  toad_curse:['frog','abyss'],arcane_barrier:['shield','violet'],mirror_entity:['portal','violet'],
  spirit_pack:['wolf','frost'],hound_release:['wolf','forest'],companion_call:['beast','forest'],
};

export function artSeed(id:string){let h=2166136261;for(let i=0;i<id.length;i++){h^=id.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function make(id:string,subject:ArtSubject,theme:ArtTheme,hero=false):ArtRecipe{const seed=artSeed(id);return{subject,theme,seed,variant:seed%7,hero};}
export function heroArtRecipe(heroClass:HeroClass){return make('hero:'+heroClass,CLASS_SUBJECT[heroClass],CLASS_THEME[heroClass],true);}
export function powerArtRecipe(heroClass:HeroClass){return make('power:'+heroClass,POWER_SUBJECT[heroClass],CLASS_THEME[heroClass]);}

/** Classification only affects art. Card effects, stats and even names can be
 * edited without changing the stable artwork associated with the card id. */
export function cardArtRecipe(card:Card):ArtRecipe{
  const id=card.id,theme=card.kind==='coin'?'gold':CLASS_THEME[card.class];
  if(card.kind==='coin')return make(id,'coin','gold');
  const override=ART_OVERRIDES[id];if(override)return make(id,override[0],override[1]);
  const has=(pattern:RegExp)=>pattern.test(id);
  if(card.kind==='minion'){
    if(card.tribe==='dragon'||has(/drake|wyrm/))return make(id,'dragon',has(/azure|frost/)?'frost':has(/twilight/)?'abyss':theme);
    if(card.tribe==='murloc')return make(id,'fishfolk','ocean');
    if(card.tribe==='totem'||has(/totem/))return make(id,'totem',has(/flame|ember/)?'ember':has(/healing/)?'gold':'ocean');
    if(card.tribe==='demon'||has(/demon_gate/))return make(id,'demon','abyss');
    if(card.tribe==='pirate'||has(/deckhand|corsair/))return make(id,'pirate','ocean');
    if(has(/wolf|hound|hyena|scavenger/))return make(id,'wolf',has(/spirit/)?'frost':has(/core/)?'ember':'forest');
    if(has(/panther|tiger|highmane|jungle_cat/))return make(id,'cat','forest');
    if(has(/bear|gorilla/))return make(id,'bear',has(/iron/)?'steel':'earth');
    if(has(/boar/))return make(id,'boar','earth');
    if(has(/hawk|owl|chicken|harpy/))return make(id,'bird',has(/owl/)?'violet':'forest');
    if(has(/snake|lizard/))return make(id,'snake','forest');
    if(has(/turtle|toad/))return make(id,'turtle','ocean');
    if(has(/sheep/))return make(id,'sheep','forest');
    if(card.tribe==='beast')return make(id,'beast',has(/tundra/)?'frost':'earth');
    if(has(/golem|construct|clockwork_token|alarm_bot|demolisher|sentinel|stone_warden|ancient_watcher/))return make(id,'golem',has(/glacial|crystal/)?'frost':has(/arcane/)?'violet':'steel');
    if(has(/wisp|wraith|spirit|elemental|mirage|light_entity|light_well|mana_wyrm|tax_collector/))return make(id,'spirit',has(/flame|lava/)?'ember':has(/frost/)?'frost':has(/light/)?'gold':'violet');
    if(has(/tree|ironwood|forest_warden|ancient_warden/))return make(id,'plant','forest');
    if(has(/abomination|fen_creeper/))return make(id,'slime','forest');
    if(has(/ogre|brute|tauren|berserker|rager|colossus|giant|shape_guardian|claw_form|guard_form/))return make(id,'brute',has(/snow|frost/)?'frost':has(/lava/)?'ember':theme);
    if(has(/dwarf|gnome|inventor|smith|brewer|engineer|alchemist/))return make(id,'dwarf','earth');
    if(has(/assassin|duelist|night_cat|shadow_blade|bandit|masked|juggler|raven/))return make(id,'rogue','steel');
    if(has(/archer|rifleman|tracker|tamer|trapper|commando/))return make(id,'archer','forest');
    if(has(/healer|cleric|priest|medic|doctor|temple|light_warden|sun_protector/))return make(id,'priest','gold');
    if(has(/mage|scholar|oracle|seer|tutor|summoner|teacher|pyromancer|spell|mind|cult|mana_|apprentice|herb|crowd/))return make(id,'mage',theme==='earth'?'violet':theme);
    return make(id,card.class==='neutral'?'knight':CLASS_SUBJECT[card.class],theme);
  }
  if(card.kind==='weapon'){
    const subject=has(/axe/)?'axe':has(/bow/)?'bow':has(/hammer|mace/)?'hammer':has(/dagger|rapier/)?'dagger':'sword';
    return make(id,subject,theme);
  }
  if(card.kind==='secret'){
    if(has(/ice|freeze/))return make(id,'ice','frost');
    if(has(/fire|explosive/))return make(id,'fire','ember');
    if(has(/eye|misdirection|mirror/))return make(id,'eye','violet');
    if(has(/redemption|repentance|noble/))return make(id,'holy','gold');
    return make(id,'trap',theme);
  }
  if(has(/fire|flame|lava|infernal|ember|explosive/))return make(id,'fire','ember');
  if(has(/frost|ice|winter|blizzard|cold_cone/))return make(id,'ice','frost');
  if(has(/lightning|thunder|bolt|earth_shock/))return make(id,'lightning','ocean');
  if(has(/healing|heal|holy|sacred|radiant|blessing|divine|light_|light$|restor|hallowed|humbling|equality/))return make(id,'holy','gold');
  if(has(/forest|wild_growth|fertile|root|grove|verdant|bloom|nature|wild_mark|wild_surge/))return make(id,'nature','forest');
  if(has(/shadow|smoke|siphon|soul_drain|life_siphon|decay|demon_pact|demon_seek|life_thread/))return make(id,'shadow','abyss');
  if(has(/book|notes|wisdom|tracking|mission|thought|mental|arcane_notes/))return make(id,'book','violet');
  if(has(/shield|barrier|final_stand|protection|test_of_steel/))return make(id,'shield','steel');
  if(has(/arrow|shot|volley|prey_mark/))return make(id,'arrow','forest');
  if(has(/hammer/))return make(id,'hammer','gold');
  if(has(/knife|stab|needle|dagger|execution/))return make(id,'dagger','steel');
  if(has(/blade|strike|cleave|sword|weapon|blow|finish|cut|steel/))return make(id,'sword','steel');
  if(has(/blood|wrath|rage|frenzy|overpower|battle_cry/))return make(id,'blood','ember');
  if(has(/wind|storm|wave|cyclone|roar/))return make(id,'storm','ocean');
  if(has(/mind|silenc|dispel|curse|hex|sentence/))return make(id,'eye','abyss');
  return make(id,'arcane',theme);
}
