import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../rooms.ts';
import { loadCatalog } from '../server.ts';
import { starterDeck, BOT_DIFFICULTIES } from '../../../packages/engine/src/index.ts';
test('AI room rejects invalid classes and pauses until human reconnects',()=>{
  const catalog=loadCatalog(),rooms=new RoomService(catalog),deck=starterDeck(catalog,'mage');
  assert.throws(()=>rooms.createBot('a',{deck,heroClass:'invalid'}),/AI 직업/);
  const session=rooms.createBot('a',{deck,heroClass:'warrior',difficulty:5}),code=session.code;
  assert.equal(rooms.botReady(code),false);
  rooms.act('a',{revision:0,action:{type:'mulligan',replace:[]}});
  assert.equal(rooms.botReady(code),true);rooms.disconnect('a');assert.equal(rooms.botReady(code),false);assert.equal(rooms.stepBot(code),false);
  rooms.resume('b',{code,token:session.token});assert.equal(rooms.botReady(code),true);
  assert.equal(rooms.stepBot(code),true);const v=rooms.view('b');assert.equal(v.state?.phase,'playing');assert.ok(v.state?.opponent.mulliganDone);assert.equal(v.botDifficulty,5);
  rooms.leave('b');assert.equal(rooms.stepBot(code),false);assert.throws(()=>rooms.resume('a',{code,token:session.token}),/만료/);
});
test('server accepts exactly 25 numeric difficulties and defaults to 3',()=>{
  const catalog=loadCatalog(),rooms=new RoomService(catalog),deck=starterDeck(catalog,'mage');
  for(const difficulty of [0,26,2.5,null,'5',{},true])assert.throws(()=>rooms.createBot('a',{deck,heroClass:'warrior',difficulty}),/난이도/);
  for(const difficulty of BOT_DIFFICULTIES){
    rooms.createBot('a',{deck,heroClass:'warrior',difficulty});assert.equal(rooms.view('a').botDifficulty,difficulty);rooms.leave('a');
  }
  rooms.createBot('a',{deck,heroClass:'warrior'});assert.equal(rooms.view('a').botDifficulty,3);rooms.leave('a');
});
test('solo server validates the chosen strategy, first player and deck seed',()=>{
  const catalog=loadCatalog(),rooms=new RoomService(catalog),deck=starterDeck(catalog,'mage');
  for(const bad of [{style:'bad'},{firstPlayer:2},{deckSeed:-1},{deckSeed:1.5}])assert.throws(()=>rooms.createBot('a',{deck,heroClass:'warrior',...bad}));
  rooms.createBot('a',{deck,heroClass:'warrior',difficulty:15,style:'control',firstPlayer:1,deckSeed:16});const view=rooms.view('a');assert.equal(view.botEngine,'server');assert.equal(view.botDeckStyle,'control');assert.equal(view.state?.firstPlayer,1);assert.equal('hand' in view.state!.opponent,false);
});
