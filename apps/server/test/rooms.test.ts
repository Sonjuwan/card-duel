import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../rooms.ts';
import { loadCatalog } from '../server.ts';
import { starterDeck,HERO_CLASSES } from '../../../packages/engine/src/index.ts';
const catalog=loadCatalog('v0.3.0.json');
const warrior=starterDeck(catalog,'warrior'),mage=starterDeck(catalog,'mage');
test('starter decks are valid for all classes, mostly affordable',()=>{for(const cls of HERO_CLASSES){const d=starterDeck(catalog,cls);assert.equal(d.cards.length,30);assert.equal(new Set(d.cards).size,15);assert.ok(d.cards.some(id=>catalog[id].cost<=2));}});
test('room creation validates deck, unique code, two seats and third join rejected',()=>{
  const r=new RoomService(catalog);assert.throws(()=>r.create('a',{...warrior,cards:[]}),/30장/);
  const s=r.create('a',warrior);assert.match(s.code,/^[A-Z2-9]{6}$/);assert.equal(r.view('a').status,'waiting');assert.throws(()=>r.create('a',mage),/이미 다른 방/);
  const b=r.join('b',{code:s.code.toLowerCase(),deck:mage});assert.equal(b.seat,1);assert.notEqual(s.token,b.token);assert.throws(()=>r.join('c',{code:s.code,deck:mage}),/이미 두 명/);
  const aView=r.view('a'),bView=r.view('b');assert.equal(aView.state?.phase,'mulligan');assert.equal(aView.state?.self.heroClass,'warrior');assert.equal(bView.state?.self.heroClass,'mage');
  assert.equal(aView.state?.opponent.handCount,bView.state?.self.handCount);assert.ok(!Object.hasOwn(aView.state!.opponent,'hand'));assert.ok(!Object.hasOwn(aView.state!.opponent,'secrets'));
  assert.ok(!Object.hasOwn(aView.state!,'rng'));assert.ok(!Object.hasOwn(aView.state!,'catalog'));
  for(const c of bView.state!.self.hand)assert.ok(!JSON.stringify(aView).includes(c.instanceId));
  for(const c of aView.state!.self.hand)assert.match(c.instanceId,/^[0-9a-f-]{36}$/);
});
test('room acts only as authenticated seat, rejects out-of-turn and stale action',()=>{
  const r=new RoomService(catalog),a=r.create('a',warrior);r.join('b',{code:a.code,deck:mage});
  assert.throws(()=>r.act('intruder',{revision:0,action:{type:'mulligan',replace:[]}}),/먼저 방/);
  r.act('a',{revision:0,action:{type:'mulligan',replace:[]}});assert.throws(()=>r.act('b',{revision:0,action:{type:'mulligan',replace:[]}}),/오래된/);
  r.act('b',{revision:1,action:{type:'mulligan',replace:[]}});const active=r.view('a').state!.activePlayer;
  const first=active===0?'a':'b',second=active===0?'b':'a';
  assert.throws(()=>r.act(second,{revision:2,actor:active,action:{type:'endTurn'}}),/자신의 턴/);
  assert.throws(()=>r.act(first,{revision:2,action:{type:'attack',attackerId:'fake',target:{kind:'hero'}}}),/공격할 수 없는/);
  r.act(first,{revision:2,action:{type:'endTurn'}});assert.equal(r.view(second).state?.revision,3);assert.equal(r.view(second).state?.activePlayer,1-active);
  assert.deepEqual(r.view(first).animation,{revision:3,actor:active,kind:'turn',events:[{kind:'draw',side:1-active,burned:false}]});assert.deepEqual(r.view(second).animation,r.view(first).animation);assert.equal(r.botDelay(a.code),1770);
  assert.throws(()=>r.act(first,{revision:2,action:{type:'endTurn'}}),/오래된/);
});
test('reconnect restores exact state, rejects invalid token and invalidates old socket',()=>{
  const r=new RoomService(catalog),a=r.create('a',warrior);const b=r.join('b',{code:a.code,deck:mage});const previous=r.view('a').state;
  r.disconnect('a');assert.equal(r.view('b').opponentConnected,false);assert.throws(()=>r.resume('c',{code:a.code,token:'a'.repeat(64)}),/권한/);
  const resumed=r.resume('c',{code:a.code,token:a.token});assert.equal(resumed.seat,0);assert.deepEqual(r.view('c').state,previous);assert.equal(r.view('b').opponentConnected,true);
  assert.throws(()=>r.act('a',{revision:0,action:{type:'concede'}}),/먼저 방/);
  r.resume('d',{code:b.code,token:b.token});assert.throws(()=>r.view('b'),/먼저 방/);assert.equal(r.view('d').seat,1);
});
test('leaving active room concedes, abandoned token cannot reconnect; waiting room removed',()=>{
  const r=new RoomService(catalog);let a=r.create('a',warrior);r.leave('a');assert.throws(()=>r.join('b',{code:a.code,deck:mage}),/존재하지/);
  a=r.create('a',warrior);r.join('b',{code:a.code,deck:mage});r.leave('a');assert.equal(r.view('b').state?.winner,1);assert.equal(r.view('b').status,'finished');assert.throws(()=>r.resume('c',{code:a.code,token:a.token}),/권한/);
});
test('both intentional leaves release room capacity immediately',()=>{
  const r=new RoomService(catalog),a=r.create('a',warrior),b=r.join('b',{code:a.code,deck:mage});r.leave('a');r.leave('b');assert.throws(()=>r.resume('c',{code:b.code,token:b.token}),/존재하지/);assert.deepEqual(r.socketsFor(a.code),[]);
});
