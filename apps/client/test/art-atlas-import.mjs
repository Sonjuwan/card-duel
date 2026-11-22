// Developer-only tool. Requires ImageMagick; no runtime dependencies.
// Inspect each atlas visually before importing: five columns, five rows.
// Usage: node apps/client/test/art-atlas-import.mjs <group> <absolute-png>
import {execFileSync} from 'node:child_process';
import {existsSync,statSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const groups={
  'heroes-and-people': 'hero-warrior hero-shaman hero-rogue hero-paladin hero-hunter hero-druid hero-warlock hero-mage hero-priest knight mage rogue priest archer brute dwarf pirate knight-guard knight-rider knight-mercenary knight-swordswoman mage-fire dwarf-alchemist mage-apprentice mage-mystic',
  'beasts-and-creatures': 'wolf cat bear boar bird snake turtle sheep fishfolk dragon beast raptor rhino crocodile ape frog panther hyena bird-owl dragon-green dragon-red beast-leviathan fishfolk-warrior spirit-wisp plant',
  'spells-and-relics': 'fire ice lightning holy nature shadow arcane shield sword axe dagger bow hammer book coin trap eye storm arrow blood nature-gem arcane-missiles holy-healing shadow-curse fire-wall',
  'knights-and-adventurers': 'foot-soldier warhorse banner-commander goblin-bomber gladiator blacksmith peacekeeper red-templar shieldbearer injured-fighter crusader adventurer auctioneer rocket-pilot frost-commander squire rogue-assassin priest-healer archer-falcon dwarf-tinkerer brute-frost brute-lava brute-tauren brute-troll ice-spear',
  'monsters-and-magic': 'demon undead golem totem spirit slime portal demon-imp undead-abomination shield-barrier sword-dark harvest-golem alarm-robot demolisher crystal-golem demon-green demon-guard demon-void demon-red elemental-water elemental-ice elemental-fire elemental-sand pirate-sailor pirate-white',
  'epic-a': 'epic-brawl epic-shield-slam epic-gorehowl epic-far-sight epic-doomhammer epic-earth-elemental epic-preparation epic-assassin epic-kidnapper epic-lay-on-hands epic-avenging-wrath epic-sword-justice epic-bestial-wrath epic-snake-trap epic-longbow epic-force-nature epic-lore epic-war epic-nether epic-bane',
  'epic-b': 'epic-pit-lord epic-pyroblast epic-ice-block epic-spellbender epic-shadowform epic-cabal epic-mindgames epic-doomsayer epic-big-game epic-blood-knight epic-faceless epic-murloc epic-pirate epic-crab epic-sea-giant epic-mountain-giant epic-molten-giant epic-parrot epic-snake epic-shadow',
  'classic-minions': 'classic-field-medic classic-herb-doctor classic-dawn-cleric classic-moon-healer classic-temple-guardian classic-young-priestess classic-sun-protector classic-spell-tutor classic-wind-oracle classic-earth-mage classic-ether-mage classic-wind-farseer classic-spell-breaker classic-mana-addict classic-tiny-summoner classic-healing-scholar classic-crowd-recruiter classic-tower-mage classic-high-mage classic-pain-scholar classic-cult-master classic-kirin-mage classic-night-cat classic-raging-wolf classic-plague-gnome',
  'classic-spells': 'classic-light-guard classic-wind-blessing classic-valor-blessing classic-restoring-ray classic-sovereign-blessing classic-hallowed-ground classic-sacred-spark classic-healing-circle classic-equality classic-divine-favor classic-humbling-light classic-starlight-barrage classic-radiant-wave classic-inner-light classic-light-well classic-holy-flame classic-redemption classic-repentance classic-wisdom-blessing classic-holy-wrath classic-moon-spark classic-star-fall classic-nature-wave classic-forest-roar classic-life-siphon',
};

const distinct=JSON.parse(readFileSync('apps/client/test/distinct-art-atlases.json','utf8'));
for(const atlas of distinct)groups[atlas.group]=atlas.cells.map(c=>c.asset).join(' ');
const names=Object.values(groups).flatMap(group=>group.split(' '));
if(names.length!==364||new Set(names).size!==364)throw new Error('Atlas mapping must cover 364 unique assets.');
const [group,input,colSpec,rowSpec]=process.argv.slice(2);
const parseEdges=(spec,count)=>{if(!spec)return undefined;const edges=spec.split(',').map(Number);if(edges.length!==count+1||edges[0]!==0||edges.at(-1)!==1||edges.some((v,i)=>!Number.isFinite(v)||i&&v<=edges[i-1]))throw new Error('Invalid normalized atlas edges');return edges;};
if(!groups[group]||!input)throw new Error('Choose one atlas group and the corresponding PNG path.');
const path=resolve(input);
if(!statSync(path).isFile())throw new Error('Input must be a file.');
const [w,h]=execFileSync('magick',['identify','-format','%w %h',path],{encoding:'utf8'}).split(' ').map(Number);
const rows=Math.ceil(groups[group].split(' ').length/5);
if(!Number.isFinite(w)||!Number.isFinite(h)||w<1000||h<1000||Math.abs(w/h-5/rows)>.15)throw new Error('Expected a regular 5-column atlas.');
const directory=resolve('apps/client/src/assets/illustrations');
for(const name of names.filter(n=>!n.startsWith('epic-')&&!n.startsWith('classic-')&&!n.startsWith('distinct-')))if(!existsSync(resolve(directory,name+'.webp')))throw new Error('Unknown artwork: '+name);

for(const [i,name] of groups[group].split(' ').entries()){
  const col=i%5,row=Math.floor(i/5),margin=3;
  // The knight atlas has slightly unequal column widths; use its inspected
  // boundary coordinates instead of allowing neighbouring portrait slivers.
  const columns=parseEdges(colSpec,5)??(group==='knights-and-adventurers'?[0,.188,.385,.585,.785,1]:[0,.2,.4,.6,.8,1]);
  const rowEdges=parseEdges(rowSpec,rows)??(group==='classic-minions'?[0,.204,.407,.612,.793,1]:group==='classic-spells'?[0,.201,.393,.585,.777,1]:Array.from({length:rows+1},(_,r)=>r/rows));
  const left=Math.round(columns[col]*w)+margin,top=Math.round(rowEdges[row]*h)+margin;
  const right=Math.round(columns[col+1]*w)-margin,bottom=Math.round(rowEdges[row+1]*h)-margin;
  const size=name.startsWith('hero-')?400:300;
  const target=resolve(directory,name+'.webp');
  const args=[path,'-crop',`${right-left}x${bottom-top}+${left}+${top}`,'+repage','-resize',`${size}x${size}^`,'-gravity','center','-extent',`${size}x${size}`];
  execFileSync('magick',[...args,'-quality','89',target]);
  if(statSync(target).size<10000)execFileSync('magick',[...args,'-quality','95',target]);
  console.log(name,size,statSync(target).size,'bytes');
}
