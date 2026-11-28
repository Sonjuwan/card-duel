import {test} from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {loadCatalog} from '../../server/server.ts';
import {HERO_CLASSES,HERO_TOKENS} from '../../../packages/engine/src/index.ts';
import {PAINTED_ASSETS,paintedCardAsset,paintedHeroAsset,paintedPowerAsset} from '../src/painted-art-model.ts';
const dir='apps/client/src/assets/illustrations';
const catalog=loadCatalog();
function webpDimensions(b:Buffer):[number,number]{
  const tag=b.toString('ascii',12,16);
  if(tag==='VP8X')return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];
  if(tag==='VP8L'){assert.equal(b[20],0x2f);const bits=b.readUInt32LE(21);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
  assert.equal(tag,'VP8 ');
  assert.equal(b.toString('hex',23,26),'9d012a');
  return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];
}
test('artwork dimensions preserve square 300px card and 400px hero crops',()=>{
  for(const asset of PAINTED_ASSETS){
    const size=asset.startsWith('hero-')?400:300;
    assert.deepEqual(webpDimensions(readFileSync(dir+'/'+asset+'.webp')),[size,size],asset);
  }
});
test('every declared illustration exists locally as a WebP, with matching CSS and no remote URL',()=>{
  const css=readFileSync('apps/client/src/painted-art.css','utf8');assert.equal(PAINTED_ASSETS.length,458);assert.equal(new Set(PAINTED_ASSETS).size,458);
  assert.equal(readdirSync(dir).length,PAINTED_ASSETS.length);
  for(const asset of PAINTED_ASSETS){const b=readFileSync(dir+'/'+asset+'.webp');assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');assert.ok(b.length>10000,asset);assert.ok(css.includes(`art-${asset}{background-image:url("./assets/illustrations/${asset}.webp")}`));}
  assert.ok(!/https?:\/\//.test(css));
});
test('all cards use known paintings and retain stable art when name, cost or description changes',()=>{
  const all=Object.values(catalog),allowed=new Set<string>(PAINTED_ASSETS),used=new Set<string>();
  for(const card of all){const asset=paintedCardAsset(card);assert.ok(allowed.has(asset),card.id);used.add(asset);if(card.kind!=='coin')assert.equal(paintedCardAsset({...card,name:'new title',cost:9,description:'new text'}),asset);}
  assert.ok(used.size>=85,`used card art: ${used.size}`);
  for(const heroClass of HERO_CLASSES){assert.ok(allowed.has(paintedHeroAsset(heroClass)));assert.ok(allowed.has(paintedPowerAsset(heroClass)));}
  assert.equal(new Set(HERO_CLASSES.map(paintedHeroAsset)).size,9);
});
test('artwork classification targets distinct iconic minions and spells',()=>{
  for(const [id,asset] of Object.entries({wisp:'spirit-wisp',wolf:'raptor',snow_brute:'brute-frost',harvest_golem:'harvest-golem',mad_alchemist:'dwarf-alchemist',flame_sphere:'fire',ice_shard:'ice-spear',arcane_barrier:'shield-barrier',abomination:'undead-abomination',wild_panther:'panther'}))assert.equal(paintedCardAsset(catalog[id]),asset);
});

test('the 38 epic cards and 50 individually repainted classic cards have distinct images',()=>{
  const epic=Object.values(catalog).filter(c=>c.kind!=='coin'&&c.rarity==='epic'&&c.collectible!==false);
  assert.equal(epic.length,38);
  const classic=["field_medic","herb_doctor","dawn_cleric","moon_healer","temple_guardian","young_priestess","sun_protector","spell_tutor","wind_oracle","earth_mage","ether_mage","wind_farseer","spell_breaker","mana_addict","tiny_summoner","healing_scholar","crowd_recruiter","tower_mage","high_mage","pain_scholar","cult_master","kirin_mage","night_cat","raging_wolf","plague_gnome","light_guard","wind_blessing","valor_blessing","restoring_ray","sovereign_blessing","hallowed_ground","sacred_spark","healing_circle","equality","divine_favor","humbling_light","starlight_barrage","radiant_wave","inner_light","light_well","holy_flame","redemption","repentance","wisdom_blessing","holy_wrath","moon_spark","star_fall","nature_wave","forest_roar","life_siphon"].map(id=>catalog[id]);
  assert.ok(classic.every(Boolean));
  assert.equal(new Set([...epic,...classic].map(c=>paintedCardAsset(c))).size,88);
});

test('every card and generated hero token has a distinct local illustration',()=>{
  const cards=[...Object.values(catalog),...HERO_TOKENS.filter(card=>!catalog[card.id])];
  const assets=new Map<string,string>(),hashes=new Map<string,string>();
  for(const card of cards){
    const asset=paintedCardAsset(card);
    assert.equal(assets.get(asset),undefined,`${card.id} shares ${asset} with ${assets.get(asset)}`);
    assets.set(asset,card.id);
    const hash=createHash('sha256').update(readFileSync(dir+'/'+asset+'.webp')).digest('hex');
    assert.equal(hashes.get(hash),undefined,`${card.id} has identical artwork to ${hashes.get(hash)}`);
    hashes.set(hash,card.id);
  }
});
test('artwork fills the shared full-card frame with proportional cover fitting',()=>{
  const frame=readFileSync('apps/client/src/local-cards.css','utf8');
  const art=readFileSync('apps/client/src/painted-art.css','utf8');
  const hover=readFileSync('apps/client/src/hover-preview.css','utf8');
  assert.match(frame,/container-type:size/);
  assert.match(frame,/--card-art-square:min\(62cqh,max\(1px,calc\(100cqh - 55px\)\)\)/);
  assert.match(frame,/\.battle-card \.card-art\{[^}]*height:57cqh;width:100%/);
  assert.match(art,/\.battle-card \.card-art \.painted-art\{background-size:cover;background-position:center 43%\}/);
  assert.match(frame,/\.collection\.classic-collection \.battle-card\{[^}]*aspect-ratio:5\/8/);
  assert.match(frame,/\.hand-card-slot\{[^}]*aspect-ratio:5\/8/);
  assert.match(hover,/\.hover-large-card\{[^}]*aspect-ratio:var\(--full-card-ratio\)/);
  assert.match(frame,/\.battle-card \.card-mana\{position:absolute/);
});
