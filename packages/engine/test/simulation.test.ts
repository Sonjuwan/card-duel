import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog,starterDeck,HERO_CLASSES,simulate,getPlayerView,deckCards } from '../src/index.ts';
import type { Catalog,HeroClass,GameState,Deck } from '../src/index.ts';
const catalog=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.5.0.json',import.meta.url),'utf8')));
test('36 full deterministic matches across all hero classes preserve state invariants',{timeout:20000},()=>{
  let steps=0;
  for(let i=0;i<36;i++){
    const a=HERO_CLASSES[i%9],b=HERO_CLASSES[(i+4)%9];
    const s=simulate(catalog,[starterDeck(catalog,a),starterDeck(catalog,b)],100+i,(state)=>{
      steps++;const ids:string[]=[];
      for(const [index,p] of state.players.entries()){
        assert.ok(p.health>=0&&p.health<=30);assert.ok(p.armor>=0);assert.ok(p.mana>=0&&p.mana<=10);assert.ok(p.maxMana>=0&&p.maxMana<=10);assert.ok(p.board.length<=7);assert.ok(p.hand.length<=10);assert.ok(p.secrets.length<=5);
        for(const c of [...p.deck,...p.hand,...p.board,...p.secrets]){ids.push(c.instanceId);assert.ok(state.catalog[c.cardId]);}
        for(const m of p.board){assert.ok(m.health>0&&m.health<=m.maxHealth);assert.ok(m.attack>=0);assert.ok(m.attacksRemaining>=0&&m.attacksRemaining<=2);}
        const view=getPlayerView(state,index===0?0:1);assert.ok(!Object.hasOwn(view.opponent,'hand'));assert.ok(!Object.hasOwn(view.opponent,'deck'));assert.ok(!Object.hasOwn(view.opponent,'secrets'));
        for(const secret of p.secrets){const name=state.catalog[secret.cardId].name;assert.ok(!state.history.some(h=>h.message===`${name} 사용`),'secret installation must not reveal identity');}
      }
      assert.equal(new Set(ids).size,ids.length);assert.ok(state.history.length<=60);
    });
    assert.equal(s.phase,'finished');assert.ok(s.winner===0||s.winner===1||s.winner===null);
  }
  assert.ok(steps>200);
});

const latest=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.6.0.json',import.meta.url),'utf8')));
const current=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.7.0.json',import.meta.url),'utf8')));
function diverseDeck(catalog:Catalog,heroClass:HeroClass,seed:number):Deck{
  const pool=deckCards(catalog,heroClass).map(c=>c.id);
  for(let i=pool.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
  return{heroClass,cards:pool.slice(0,15).flatMap(id=>[id,id])};
}
test('36 additional randomized-deck matches run the v0.6 catalog with diverse cards',{timeout:30000},()=>{
  let steps=0;const observed=new Set<string>();
  function check(s:GameState){
    steps++;const ids:string[]=[];
    for(const p of s.players){assert.ok(p.health>=0&&p.health<=30);assert.ok(p.mana>=0&&p.mana<=10);assert.ok(p.maxMana>=0&&p.maxMana<=10);assert.ok(p.board.length<=7&&p.hand.length<=10&&p.secrets.length<=5);
      ids.push(...[...p.board,...p.hand,...p.deck,...p.secrets].map(c=>c.instanceId));for(const m of p.board){assert.ok(m.health>0&&m.health<=m.maxHealth);assert.ok(m.attack>=0);assert.ok(m.attacksRemaining>=0&&m.attacksRemaining<=2);observed.add(m.cardId);}}
    assert.equal(new Set(ids).size,ids.length);
  }
  for(let i=0;i<36;i++){const a=HERO_CLASSES[i%9],b=HERO_CLASSES[(i+5)%9];const s=simulate(latest,[diverseDeck(latest,a,1000+i),diverseDeck(latest,b,2000+i)],300+i,check);assert.equal(s.phase,'finished');}
  assert.ok(steps>200);assert.ok(observed.size>=35);
});
test('36 more randomized-deck matches on v0.7 include weapons, ownership and private views',{timeout:30000},()=>{
  let steps=0;
  for(let i=0;i<36;i++){const a=HERO_CLASSES[i%9],b=HERO_CLASSES[(i+3)%9];const s=simulate(current,[diverseDeck(current,a,3100+i),diverseDeck(current,b,4100+i)],700+i,state=>{
    steps++;const ids:string[]=[];
    for(const [seat,p] of state.players.entries()){
      assert.ok(p.health>=0&&p.health<=30&&p.armor>=0&&p.mana>=0&&p.mana<=10);assert.ok(p.board.length<=7&&p.hand.length<=10&&p.secrets.length<=5);
      ids.push(...[...p.hand,...p.deck,...p.board,...p.secrets].map(c=>c.instanceId));for(const m of p.board){assert.ok(m.health>0&&m.health<=m.maxHealth&&m.attack>=0);assert.ok(m.originalOwner===0||m.originalOwner===1);if(m.returnController!==undefined)assert.notEqual(m.returnController,seat);}
      if(p.weapon)assert.ok(p.weapon.attack>=0&&p.weapon.durability>0);
      const v=getPlayerView(state,seat===0?0:1);assert.ok(!Object.hasOwn(v.opponent,'hand')&&!Object.hasOwn(v.opponent,'deck')&&!Object.hasOwn(v.opponent,'secrets'));
    }assert.equal(new Set(ids).size,ids.length);
  });assert.equal(s.phase,'finished');}assert.ok(steps>200);
});
