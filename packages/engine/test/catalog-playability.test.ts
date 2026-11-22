import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,candidates,cardChoiceReason,createCatalog,createGame,getPlayerView,practiceDeck,publicCardReason,RuleError,RULES} from '../src/index.ts';
import type {Card,GameState,HeroClass,Minion,PlayerId} from '../src/index.ts';

const catalog=createCatalog(JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json',import.meta.url),'utf8')));
const collectible=Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false);
function fixture(card:Card,rich:boolean,combo:boolean):GameState{
  const heroClass:HeroClass=card.kind==='coin'||card.class==='neutral'?'mage':card.class;
  let s=createGame(catalog,[practiceDeck(catalog,heroClass),practiceDeck(catalog,'warrior')],{seed:67,firstPlayer:0});
  s=applyAction(s,0,{type:'mulligan',replace:[]});s=applyAction(s,1,{type:'mulligan',replace:[]});
  const p=s.players[0];p.mana=rich?10:1;p.maxMana=p.mana;p.health=10;p.cardsPlayedThisTurn=combo?1:0;p.minionsPlayedThisTurn=combo?1:0;
  p.hand=[{cardId:card.id,instanceId:'card-under-test'}];if(rich&&card.id==='mountain_giant')p.hand.push({cardId:'wisp',instanceId:'extra-1'},{cardId:'wisp',instanceId:'extra-2'});
  const place=(id:PlayerId,cardId:string,damage=0)=>{const c=s.catalog[cardId];assert.ok(c.kind==='minion');const m:Minion={cardId,instanceId:`fixture-${s.nextId++}`,originalOwner:id,attack:c.attack,health:c.health-damage,maxHealth:c.health,attacksRemaining:1,keywords:[...(c.keywords??[])],enteredOrder:s.nextEntryOrder??1};s.nextEntryOrder=(s.nextEntryOrder??1)+1;s.players[id].board.push(m);};
  if(rich){p.weapon={attack:3,durability:2};place(0,'wolf');place(0,'void_sentinel');place(0,'snow_brute',1);place(0,'ogre');place(1,'wolf',1);place(1,'snow_brute');place(1,'ogre');place(1,'night_cat');place(1,'wisp');}
  return s;
}
function check(card:Card,rich:boolean,combo:boolean){
  const s=fixture(card,rich,combo),view=getPlayerView(s,0),h=s.players[0].hand[0];
  const actions=candidates(s,0).filter(a=>a.type==='playCard'&&a.instanceId===h.instanceId);
  const success=new Set<number|undefined>();let accepted=0;
  for(const action of actions){if(action.type!=='playCard')continue;try{const next=applyAction(s,0,action);accepted++;success.add(action.choice);assert.equal(next.revision,s.revision+1);assert.ok(next.players[0].board.length<=RULES.maxBoard);assert.ok(!next.players[0].hand.some(c=>c.instanceId===h.instanceId));if(next.pendingChoice){const chosen=next.pendingChoice.cards[0];assert.ok(chosen);assert.doesNotThrow(()=>applyAction(next,0,{type:'chooseDeckCard',instanceId:chosen.instanceId}));}}catch(e){if(!(e instanceof RuleError))throw e;}}
  const reason=publicCardReason(view,0,h,s.catalog);
  assert.equal(!reason,accepted>0,`${card.id}: ${rich?'rich':'sparse'}, combo=${combo}, UI=${reason??'allowed'}, accepted=${accepted}`);
  if((card.kind==='minion'||card.kind==='spell')&&!reason)for(let i=0;i<(card.choices?.length??0);i++){assert.equal(!cardChoiceReason(view,0,card,s.catalog,i),success.has(i),`${card.id} choice ${i}`);if(rich)assert.ok(success.has(i),`${card.id} missing choice ${i}`);}
  return accepted;
}
test('all 382 active cards and each choice can be played with a legal target in a rich fixture; UI agrees with server',{timeout:60000},t=>{assert.equal(collectible.length,382);let actions=0;for(const c of collectible){const a=check(c,true,false),b=check(c,true,true);assert.ok(a+b>0,c.id);actions+=a+b;}assert.ok(actions>500);t.diagnostic(`${actions} accepted card actions across full and combo fixtures`);});
test('all 382 active cards have consistent UI/server legality from a sparse one-mana empty battlefield',{timeout:60000},t=>{let actions=0;for(const card of collectible)actions+=check(card,false,false);t.diagnostic(`${actions} accepted card actions in sparse fixture`);});
