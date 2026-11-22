import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { createDuelServer,loadCatalog } from '../server.ts';
import { deckCards,HERO_CLASSES,rankBotActions } from '../../../packages/engine/src/index.ts';
import type { Deck,HeroClass,PlayerId } from '../../../packages/engine/src/index.ts';
import type { ClientEvents,ServerEvents,RoomView,Result,Session } from '../../../packages/protocol.ts';

type Client=Socket<ServerEvents,ClientEvents>;
function ack<T>(fn:(cb:(r:Result<T>)=>void)=>void):Promise<Result<T>>{
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Epic socket ack timed out')),4000);fn(r=>{clearTimeout(timer);resolve(r);});});
}
function success<T>(r:Result<T>):T{assert.ok(r.ok,r.ok?'':r.error);return r.data;}

test('nine epic-rich matches via independent real Socket.IO clients validate public state and finish',{timeout:90000},async()=>{
  const catalog=loadCatalog(),{http,io}=createDuelServer(catalog);
  http.listen(0,'127.0.0.1');await once(http,'listening');
  const address=http.address();assert.ok(address&&typeof address==='object');
  const url=`http://127.0.0.1:${address.port}`;
  function deck(cls:HeroClass):Deck{
    const legal=deckCards(catalog,cls);
    const epics=legal.filter(c=>c.rarity==='epic'&&c.class===cls);
    const neutral=legal.filter(c=>c.rarity==='epic'&&c.class==='neutral'&&c.cost<=5).slice(0,4);
    const cheap=legal.filter(c=>c.kind==='minion'&&c.rarity!=='epic'&&c.cost<=3&&c.attack>=1&&!c.noAttack&&!c.choices&&!c.targetRule).slice(0,8);
    assert.equal(epics.length,3);assert.equal(neutral.length,4);assert.equal(cheap.length,8);
    return {heroClass:cls,cards:[...epics,...neutral,...cheap].flatMap(c=>[c.id,c.id])};
  }
  let played=0,moves=0;
  try{
    await Promise.all(HERO_CLASSES.map(async(_,i)=>{
      const clients=([0,1] as const).map(()=>connect(url,{forceNew:true,transports:['websocket'],reconnection:false})) as [Client,Client];
      try{
        await Promise.all(clients.map(c=>c.connected?Promise.resolve():new Promise<void>((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error('connect timeout')),4000);
          c.once('connect',()=>{clearTimeout(timer);resolve();});
        })));
        const latest:[RoomView|undefined,RoomView|undefined]=[undefined,undefined];
        clients.forEach((c,seat)=>c.on('room:view',v=>{latest[seat as PlayerId]=v;}));
        const waitRevision=async(revision:number)=>Promise.all(clients.map((c,seat)=>new Promise<RoomView>((resolve,reject)=>{
          const existing=latest[seat as PlayerId];if(existing?.state?.revision===revision){resolve(existing);return;}
          const listener=(v:RoomView)=>{if(v.state?.revision===revision){clearTimeout(timer);c.off('room:view',listener);resolve(v);}};
          const timer=setTimeout(()=>{c.off('room:view',listener);reject(new Error('broadcast timeout'));},4000);
          c.on('room:view',listener);
        })));
        const session=success(await ack<Session>(cb=>clients[0].emit('room:create',deck(HERO_CLASSES[i]),cb)));
        success(await ack<Session>(cb=>clients[1].emit('room:join',{code:session.code,deck:deck(HERO_CLASSES[(i+4)%9])},cb)));
        let views=await waitRevision(0);
        for(let turn=0;views[0].state!.phase!=='finished'&&turn<1500;turn++){
          const seat:PlayerId=views[0].state!.phase==='mulligan'?(views[0].state!.self.mulliganDone?1:0):views[0].state!.activePlayer;
          const before=views[seat].state!;
          let accepted=false;const errors:string[]=[];
          for(const action of rankBotActions(before,catalog,seat,3)){
            let r=await ack<RoomView>(cb=>clients[seat].emit('room:action',{revision:before.revision,action},cb));
            // Respect the production request quota rather than disabling it for test.
            if(!r.ok&&r.error.includes('요청이 너무 많습니다')){
              await new Promise(resolve=>setTimeout(resolve,10100));
              r=await ack<RoomView>(cb=>clients[seat].emit('room:action',{revision:before.revision,action},cb));
            }
            if(!r.ok){errors.push(r.error);continue;}
            accepted=true;moves++;
            if(action.type==='playCard'){
              const def=catalog[before.self.hand.find(c=>c.instanceId===action.instanceId)!.cardId];
              if(def.kind!=='coin'&&def.rarity==='epic')played++;
            }
            break;
          }
          assert.ok(accepted,'each round has a server-accepted action: '+errors.join(', '));
          views=await waitRevision(before.revision+1);
          const [a,b]=views.map(v=>v.state!);
          assert.equal(a.revision,b.revision);assert.equal(a.revision,before.revision+1);
          assert.equal(a.self.health,b.opponent.health);assert.equal(b.self.health,a.opponent.health);
          assert.equal(a.self.hand.length,b.opponent.handCount);assert.equal(b.self.hand.length,a.opponent.handCount);
          assert.deepEqual(a.self.board,b.opponent.board);assert.deepEqual(b.self.board,a.opponent.board);
          for(const view of [a,b]){
            assert.ok(!Object.hasOwn(view.opponent,'hand')&&!Object.hasOwn(view.opponent,'deck')&&!Object.hasOwn(view.opponent,'secrets'));
            assert.ok(!Object.hasOwn(view,'rng')&&!Object.hasOwn(view,'catalog'));
          }
          assert.equal(a.winner,b.winner);
        }
        assert.equal(views[0].state!.phase,'finished');assert.equal(views[1].state!.phase,'finished');
      }finally{clients.forEach(c=>c.disconnect());}
    }));
    assert.ok(played>0,'epic cards were actually played via Socket.IO');
    console.log(`Epic online integration: 9 matches, ${moves} accepted actions, ${played} epic plays.`);
  }finally{await io.close();}
});
