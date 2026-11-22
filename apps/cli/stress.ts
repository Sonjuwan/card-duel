import assert from 'node:assert/strict';
import { CardStore } from '../server/card-store.ts';
import { deckCards, HERO_CLASSES, simulate, getPlayerView, RULES,maxCardCopies } from '../../packages/engine/src/index.ts';
import type { Deck,HeroClass,GameState } from '../../packages/engine/src/index.ts';

const count=Number(process.argv[2]??100);
if(!Number.isInteger(count)||count<1||count>1000)throw new Error('경기 수는 1~1000을 입력하세요.');
const start=Number(process.argv[3]??0);
if(!Number.isInteger(start)||start<0||start>100000)throw new Error('시작 경기 번호는 0~100000을 입력하세요.');
const mode=process.argv[4]??'random';
if(!['random','epic','legendary'].includes(mode))throw new Error('덱 검사 모드는 random, epic 또는 legendary를 입력하세요.');
const {version,catalog}=new CardStore().read();
const eligible=Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false);
function shuffledDeck(heroClass:HeroClass,seed:number):Deck {
  const cards=deckCards(catalog,heroClass).map(c=>c.id);
  for(let i=cards.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=Math.floor(seed/4294967296*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
  return{heroClass,cards:cards.flatMap(id=>Array<string>(maxCardCopies(catalog[id])).fill(id)).slice(0,30)};
}
function legendaryDeck(heroClass:HeroClass,seed:number):Deck{
  const list=deckCards(catalog,heroClass);
  const shuffled=<T,>(items:T[]):T[]=>{for(let i=items.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=Math.floor(seed/4294967296*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;};
  const legendary=[...list.filter(c=>c.rarity==='legendary'&&c.class===heroClass),...shuffled(list.filter(c=>c.rarity==='legendary'&&c.class==='neutral')).slice(0,9)];
  const cheap=shuffled(list.filter(c=>c.rarity!=='legendary'&&c.cost<=4));
  return{heroClass,cards:[...legendary.map(c=>c.id),...cheap.flatMap(c=>[c.id,c.id])].slice(0,30)};
}
// Epic-heavy scenario: 18 epic cards per deck, every class epic and a
// rotating neutral group, paired with affordable minions.
function epicDeck(heroClass:HeroClass,seed:number):Deck {
  const list=deckCards(catalog,heroClass);
  const classEpics=list.filter(c=>c.rarity==='epic'&&c.class===heroClass);
  const neutral=list.filter(c=>c.rarity==='epic'&&c.class==='neutral');
  const cheap=list.filter(c=>c.rarity!=='epic'&&c.kind==='minion'&&c.cost<=3);
  function shuffle<T>(cards:T[]):T[]{
    for(let i=cards.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=Math.floor(seed/4294967296*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
    return cards;
  }
  return {heroClass,cards:[...classEpics,...shuffle(neutral).slice(0,6),...shuffle(cheap).slice(0,6)].flatMap(c=>[c.id,c.id])};
}
let moves=0,epicPlays=0,legendaryPlays=0;const played=new Set<string>(),finishes={health:0,fatigue:0,concede:0,turnLimit:0,draw:0};
console.log(`Card Duel stress: ${version}, ${count} matches, ${eligible.length} deck cards, ${mode} mode`);
for(let index=0;index<count;index++){
  const i=start+index;
  // Enumerate all 81 ordered class pairings, including mirrors.
  const a=HERO_CLASSES[i%9],b=HERO_CLASSES[Math.floor(i/9)%9];let previous:GameState|undefined;
  const decks:[Deck,Deck]=mode==='legendary'?[legendaryDeck(a,9001+i*17),legendaryDeck(b,3010+i*37)]:mode==='epic'?[epicDeck(a,9001+i*17),epicDeck(b,3010+i*37)]:[shuffledDeck(a,7071+i*103),shuffledDeck(b,1829+i*147)],seed=mode==='epic'?10000+i*113:5096+i*223;
  let final:GameState;
  try{final=simulate(catalog,decks,seed,(s,action)=>{
    moves++;assert.equal(s.revision,(previous?.revision??0)+1);assert.ok(s.turn<=RULES.maxTurns);
    if(previous&&action.type==='playCard'){const card=previous.players[previous.activePlayer].hand.find(c=>c.instanceId===action.instanceId);assert.ok(card);played.add(card.cardId);const def=previous.catalog[card.cardId];if(def.kind!=='coin'&&def.rarity==='epic')epicPlays++;if(def.kind!=='coin'&&def.rarity==='legendary')legendaryPlays++;}
    previous=s;const instances:string[]=[];
    for(const id of [0,1] as const){const p=s.players[id];assert.ok(p.health>=0&&p.health<=RULES.heroHealth&&p.armor>=0);assert.ok(p.mana>=0&&p.mana<=RULES.maxMana&&p.maxMana<=RULES.maxMana);
      assert.ok(p.hand.length<=RULES.maxHand&&p.board.length<=RULES.maxBoard&&p.secrets.length<=RULES.maxSecrets);
      for(const c of [...p.board,...p.deck,...p.hand,...p.secrets]){instances.push(c.instanceId);assert.ok(s.catalog[c.cardId]);}
      for(const m of p.board){assert.ok(m.health>0&&m.health<=m.maxHealth&&m.attack>=0);assert.ok(m.attacksRemaining>=0&&m.attacksRemaining<=2);assert.ok(m.originalOwner===0||m.originalOwner===1);}
      if(p.weapon)assert.ok(p.weapon.durability>0&&p.weapon.attack>=0);
      const view=getPlayerView(s,id);assert.equal(view.self.hand.length,p.hand.length);assert.equal(view.opponent.handCount,s.players[id===0?1:0].hand.length);assert.ok(!Object.hasOwn(view.opponent,'hand')&&!Object.hasOwn(view.opponent,'deck')&&!Object.hasOwn(view.opponent,'secrets'));assert.ok(!Object.hasOwn(view,'rng')&&!Object.hasOwn(view,'catalog'));
    }for(const c of s.pendingChoice?.cards??[]){instances.push(c.instanceId);assert.ok(s.catalog[c.cardId]);}assert.equal(new Set(instances).size,instances.length);
  });}catch(error){console.error('경기 실패. 재현 명령: npm run stress -- 1 '+i+' '+mode,JSON.stringify({version,index:i,seed,decks,revision:previous?.revision,history:previous?.history.slice(-12)}));throw error;}
  assert.equal(final.phase,'finished');if(final.winner===null)finishes.draw++;else if(final.reason)finishes[final.reason]++;
  if((index+1)%50===0||index+1===count)console.log(`${index+1}/${count} matches complete; ${moves} actions`);
}
const missed=eligible.filter(c=>!played.has(c.id)).map(c=>c.id);
console.log(`Complete. Results: ${JSON.stringify(finishes)}`);
console.log(`Deck cards played at least once: ${eligible.length-missed.length}/${eligible.length}`);
if(missed.length)console.log(`Not observed: ${missed.join(', ')}`);
if(mode==='epic'){const epics=eligible.filter(c=>c.kind!=='coin'&&c.rarity==='epic');console.log(`Epic coverage: ${epics.filter(c=>played.has(c.id)).length}/${epics.length}, ${epicPlays} plays`);}
if(mode==='legendary'){const legendary=eligible.filter(c=>c.kind!=='coin'&&c.rarity==='legendary');console.log(`Legendary coverage: ${legendary.filter(c=>played.has(c.id)).length}/${legendary.length}, ${legendaryPlays} plays`);}
