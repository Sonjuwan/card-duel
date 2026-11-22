import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCatalog,deckCards,HERO_CLASSES} from '../../../packages/engine/src/index.ts';
import {cardSet,matchesCardSet,cardSetLabel,sortCardsForDisplay} from '../src/card-sets.ts';
import {displayCardName} from '../src/card-names.ts';
import {collectionPage} from '../src/table-visuals.ts';
const active=JSON.parse(readFileSync('data/cards/active.json','utf8')) as {file:string};
const catalog=createCatalog(JSON.parse(readFileSync('data/cards/'+active.file,'utf8')));
const all=Object.values(catalog);
test('382 collectible cards partition into 133 basic and 249 original, never including generated cards',()=>{
  assert.equal(all.filter(c=>cardSet(c)==='basic').length,133);
  assert.equal(all.filter(c=>cardSet(c)==='original').length,249);
  for(const card of all){if(cardSet(card)==='original')assert.ok(card.kind!=='coin'&&['common','rare','epic','legendary'].includes(card.rarity));else if(cardSet(card)==='token'){assert.ok(!matchesCardSet(card,'basic'));assert.ok(!matchesCardSet(card,'original'));}}
});
test('each class legal deck list partitions exactly between sets; all preserves legal order',()=>{
  for(const heroClass of HERO_CLASSES){const legal=deckCards(catalog,heroClass),basic=legal.filter(c=>matchesCardSet(c,'basic')),original=legal.filter(c=>matchesCardSet(c,'original'));assert.equal(legal.length,basic.length+original.length);assert.equal(new Set([...basic,...original].map(c=>c.id)).size,legal.length);assert.deepEqual(legal.filter(c=>matchesCardSet(c,'all')),legal);assert.ok(basic.every(c=>cardSetLabel(c)==='기본 카드'));assert.ok(original.every(c=>cardSetLabel(c)==='오리지널 카드'));}
});
test('historical membership survives balance changes and new cards use a rarity fallback',()=>{
  const basic=catalog.recruit,original=catalog.crystal_sentinel;assert.ok(basic.kind!=='coin'&&original.kind!=='coin');
  assert.equal(cardSet({...basic,rarity:'rare'}),'basic');assert.equal(cardSet({...original,rarity:'basic'}),'original');
  assert.equal(cardSet({...basic,id:'new_custom',rarity:'rare'}),'original');assert.equal(cardSet({...original,id:'another_custom',rarity:'basic'}),'basic');
});
test('all classes and sets are sorted by cost then visible name before pagination, without mutating cards',()=>{
  for(const hero of HERO_CLASSES)for(const set of ['all','basic','original'] as const)for(const classic of [true,false]){
    const input=deckCards(catalog,hero).filter(c=>matchesCardSet(c,set)).reverse();const original=[...input];
    const sorted=sortCardsForDisplay(input,classic);assert.deepEqual(input,original);
    for(let i=1;i<sorted.length;i++){
      assert.ok(sorted[i-1].cost<=sorted[i].cost);
      if(sorted[i-1].cost===sorted[i].cost)assert.ok(displayCardName(sorted[i-1],classic).localeCompare(displayCardName(sorted[i],classic),'ko',{numeric:true,sensitivity:'base'})<=0);
    }
    const paged=Array.from({length:collectionPage(sorted,0).pages},(_,i)=>collectionPage(sorted,i).items).flat();assert.deepEqual(paged,sorted);
  }
});
