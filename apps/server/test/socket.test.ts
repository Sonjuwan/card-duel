import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { createDuelServer,loadCatalog } from '../server.ts';
import { starterDeck,deckCards,hasKeyword,currentCost } from '../../../packages/engine/src/index.ts';
import type { Action,Deck,GameState } from '../../../packages/engine/src/index.ts';
import type { ClientEvents,ServerEvents,RoomView,Result,Session } from '../../../packages/protocol.ts';
type Client=Socket<ServerEvents,ClientEvents>;
function waitConnected(client:Client):Promise<void>{return client.connected?Promise.resolve():new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('connect timeout')),5000);client.once('connect',()=>{clearTimeout(timeout);resolve();});});}
function waitView(client:Client,predicate:(v:RoomView)=>boolean,timeout=5000):Promise<RoomView>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{client.off('room:view',listener);reject(new Error('view timeout'));},timeout);const listener=(view:RoomView)=>{if(!predicate(view))return;clearTimeout(timer);client.off('room:view',listener);resolve(view);};client.on('room:view',listener);});}
function ack<T>(fn:(cb:(r:Result<T>)=>void)=>void):Promise<Result<T>>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('ack timeout')),5000);fn(r=>{clearTimeout(timer);resolve(r);});});}
function success<T>(r:Result<T>):T{assert.ok(r.ok,r.ok?'':r.error);return r.data;}
test('Nozdormu server starts an authoritative clock, automatically ends both players turns, and broadcasts a new deadline',{timeout:20000},async()=>{
  const catalog=loadCatalog('v0.23.0.json');const nozdormu=catalog.nozdormu;assert.ok(nozdormu.kind==='minion');nozdormu.turnTimeLimitSeconds=5;
  const {http,io,rooms}=createDuelServer(catalog);http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');
  const clients=[connect(`http://127.0.0.1:${address.port}`,{forceNew:true}),connect(`http://127.0.0.1:${address.port}`,{forceNew:true})] as [Client,Client];
  try{
    await Promise.all(clients.map(waitConnected));const deck=starterDeck(catalog,'mage');const session=success(await ack<Session>(cb=>clients[0].emit('room:create',deck,cb)));success(await ack<Session>(cb=>clients[1].emit('room:join',{code:session.code,deck},cb)));
    success(await ack<RoomView>(cb=>clients[0].emit('room:action',{revision:0,action:{type:'mulligan',replace:[]}},cb)));
    const view=success(await ack<RoomView>(cb=>clients[1].emit('room:action',{revision:1,action:{type:'mulligan',replace:[]}},cb)));
    // Test fixture only: give the current player enough mana and the exact
    // card to avoid waiting for nine random draws; the real action is socket-validated.
    const room=(rooms as unknown as {rooms:Map<string,{state:GameState}>}).rooms.get(session.code)!;
    const actor=view.state!.activePlayer;room.state.players[actor].mana=10;room.state.players[actor].maxMana=10;room.state.players[actor].hand.push({cardId:'nozdormu',instanceId:'nozd-timer-fixture'});
    const timed=success(await ack<RoomView>(cb=>clients[actor].emit('room:action',{revision:2,action:{type:'playCard',instanceId:'nozd-timer-fixture'}},cb)));
    assert.ok(timed.turnDeadlineMs&&timed.turnDeadlineMs>Date.now());assert.equal(timed.state!.activePlayer,actor);
    const next=await waitView(clients[actor],v=>v.state?.revision===4,8000);assert.equal(next.state!.activePlayer,1-actor);assert.ok(next.turnDeadlineMs!>timed.turnDeadlineMs);
    assert.equal((await ack<RoomView>(cb=>clients[actor].emit('room:action',{revision:3,action:{type:'endTurn'}},cb))).ok,false);
    const again=await waitView(clients[actor],v=>v.state?.revision===5,8000);assert.equal(again.state!.activePlayer,actor);assert.ok(again.turnDeadlineMs!>next.turnDeadlineMs!);
  }finally{for(const c of clients)c.disconnect();await io.close();}
});
test('explicit room sync recovers the authoritative view without changing revision or exposing private cards',{timeout:20000},async()=>{
  const catalog=loadCatalog(),{http,io}=createDuelServer(catalog);http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}`;
  const a:Client=connect(url,{forceNew:true,transports:['websocket']}),b:Client=connect(url,{forceNew:true,transports:['websocket']}),stranger:Client=connect(url,{forceNew:true,transports:['websocket']});
  try{
    await Promise.all([a,b,stranger].map(waitConnected));assert.equal((await ack<RoomView>(cb=>stranger.emit('room:sync',cb))).ok,false);
    const waiting=waitView(a,v=>v.status==='waiting');const session=success(await ack<Session>(cb=>a.emit('room:create',starterDeck(catalog,'mage'),cb)));await waiting;
    const va=waitView(a,v=>v.state?.phase==='mulligan'),vb=waitView(b,v=>v.state?.phase==='mulligan');success(await ack<Session>(cb=>b.emit('room:join',{code:session.code,deck:starterDeck(catalog,'hunter')},cb)));const [before,other]=await Promise.all([va,vb]);
    const synced=success(await ack<RoomView>(cb=>a.emit('room:sync',cb)));assert.deepEqual(synced,before);assert.equal(synced.state!.revision,0);assert.ok(!JSON.stringify(synced.state).includes(other.state!.self.hand[0].instanceId));
    const next=waitView(a,v=>v.state?.revision===1);const committed=success(await ack<RoomView>(cb=>a.emit('room:action',{revision:0,action:{type:'mulligan',replace:[]}},cb)));const latest=await next;
    assert.deepEqual(committed,latest);assert.equal(committed.state!.revision,1);assert.ok(!JSON.stringify(committed).includes(other.state!.self.hand[0].instanceId));
    assert.equal((await ack<RoomView>(cb=>a.emit('room:action',{revision:0,action:{type:'mulligan',replace:[]}},cb))).ok,false);assert.deepEqual(success(await ack<RoomView>(cb=>a.emit('room:sync',cb))),latest);
  }finally{a.disconnect();b.disconnect();stranger.disconnect();await io.close();}
});
test('latest catalogue: two independent socket clients complete a natural health victory with no private state leak',{timeout:25000},async()=>{
  const catalog=loadCatalog(),{http,io}=createDuelServer(catalog);http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}`;
  const clients:[Client,Client]=[connect(url,{forceNew:true,transports:['websocket']}),connect(url,{forceNew:true,transports:['websocket']})];
  const cards=deckCards(catalog,'warrior').filter(c=>c.kind==='minion'&&c.class==='neutral'&&c.cost<=3&&c.attack>=2&&c.rarity!=='legendary'&&!c.noAttack&&!c.targetRule&&!c.choices&&!c.keywords?.includes('taunt')).slice(0,15).flatMap(c=>[c.id,c.id]);assert.equal(cards.length,30);
  const deck:Deck={heroClass:'warrior',cards};
  try{
    await Promise.all(clients.map(waitConnected));const ready=waitView(clients[0],v=>v.status==='waiting');const session=success(await ack<Session>(cb=>clients[0].emit('room:create',deck,cb)));await ready;
    const started=clients.map(c=>waitView(c,v=>v.state?.phase==='mulligan'));success(await ack<Session>(cb=>clients[1].emit('room:join',{code:session.code,deck},cb)));let views=await Promise.all(started);
    const act=async(seat:0|1,action:Action)=>{const revision=views[0].state!.revision;const pending=clients.map(c=>waitView(c,v=>v.state?.revision===revision+1));success(await ack<RoomView>(cb=>clients[seat].emit('room:action',{revision,action},cb)));views=await Promise.all(pending);
      const [left,right]=views.map(v=>v.state!);assert.equal(left.revision,right.revision);assert.equal(left.winner,right.winner);assert.equal(left.self.health,right.opponent.health);assert.equal(right.self.health,left.opponent.health);assert.deepEqual(left.self.board,right.opponent.board);assert.deepEqual(right.self.board,left.opponent.board);
      for(const v of [left,right]){assert.ok(!Object.hasOwn(v.opponent,'hand')&&!Object.hasOwn(v.opponent,'deck')&&!Object.hasOwn(v.opponent,'secrets'));assert.ok(!Object.hasOwn(v,'rng')&&!Object.hasOwn(v,'catalog'));}
    };
    await act(0,{type:'mulligan',replace:[]});await act(1,{type:'mulligan',replace:[]});
    let played=0,attacked=0;
    for(let i=0;i<100&&views[0].status!=='finished';i++){
      const seat=views[0].state!.activePlayer,v=views[seat].state!,p=v.self;
      const attacker=p.board.find(m=>m.attack>0&&m.attacksRemaining>0&&m.frozenThroughTurn===undefined);
      if(attacker){const guard=v.opponent.board.find(m=>hasKeyword(m,'taunt')&&!hasKeyword(m,'stealth'));await act(seat,{type:'attack',attackerId:attacker.instanceId,target:guard?{kind:'minion',instanceId:guard.instanceId}:{kind:'hero'}});attacked++;continue;}
      const boards=seat===0?[p.board,v.opponent.board] as const:[v.opponent.board,p.board] as const;
      const playable=p.hand.find(h=>catalog[h.cardId].kind==='minion'&&currentCost(catalog[h.cardId],catalog,seat,[...boards],p.weapon,h.costDiscount,p.nextSecretFree,p.minionsPlayedThisTurn)<=p.mana);
      if(playable&&p.board.length<7){await act(seat,{type:'playCard',instanceId:playable.instanceId});played++;continue;}
      await act(seat,{type:'endTurn'});
    }
    assert.equal(views[0].status,'finished');assert.equal(views[1].status,'finished');assert.equal(views[0].state!.reason,'health');assert.ok(played>0&&attacked>0);assert.notEqual(views[0].state!.winner,null);
  }finally{clients.forEach(c=>c.disconnect());await io.close();}
});
test('two real Socket.IO clients play a match through the server, reconnect and concede',{timeout:20000},async()=>{
  const catalog=loadCatalog('v0.3.0.json'),{http,io}=createDuelServer(catalog);http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}`;
  const a:Client=connect(url,{forceNew:true,transports:['websocket']}),b:Client=connect(url,{forceNew:true,transports:['websocket']});let c:Client|undefined;
  try{
    await Promise.all([waitConnected(a),waitConnected(b)]);
    const waitA=waitView(a,v=>v.status==='waiting');const session=success(await ack<Session>(cb=>a.emit('room:create',starterDeck(catalog,'warrior'),cb)));assert.equal((await waitA).code,session.code);
    const va=waitView(a,v=>v.state?.phase==='mulligan'),vb=waitView(b,v=>v.state?.phase==='mulligan');success(await ack<Session>(cb=>b.emit('room:join',{code:session.code,deck:starterDeck(catalog,'mage')},cb)));
    const views=await Promise.all([va,vb]);assert.equal(views[0].state?.opponent.handCount,views[1].state?.self.handCount);assert.ok(!Object.hasOwn(views[0].state!.opponent,'hand'));
    const nextA=waitView(a,v=>v.state?.revision===1);success(await ack<RoomView>(cb=>a.emit('room:action',{revision:0,action:{type:'mulligan',replace:[]}},cb)));await nextA;
    const startA=waitView(a,v=>v.state?.phase==='playing'),startB=waitView(b,v=>v.state?.phase==='playing');success(await ack<RoomView>(cb=>b.emit('room:action',{revision:1,action:{type:'mulligan',replace:[]}},cb)));
    const [stateA]=await Promise.all([startA,startB]);const active=stateA.state!.activePlayer===0?a:b,other=active===a?b:a;
    const invalid=await ack<RoomView>(cb=>other.emit('room:action',{revision:2,action:{type:'endTurn'}},cb));assert.equal(invalid.ok,false);
    const turnA=waitView(a,v=>v.state?.revision===3);success(await ack<RoomView>(cb=>active.emit('room:action',{revision:2,action:{type:'endTurn'}},cb)));await turnA;
    const disconnected=waitView(b,v=>!v.opponentConnected);a.disconnect();await disconnected;
    c=connect(url,{forceNew:true,transports:['websocket']});await waitConnected(c);const resumeView=waitView(c,v=>v.state?.revision===3);success(await ack<Session>(cb=>c!.emit('room:resume',{code:session.code,token:session.token},cb)));assert.equal((await resumeView).seat,0);
    const finish=waitView(b,v=>v.status==='finished');success(await ack<RoomView>(cb=>c!.emit('room:action',{revision:3,action:{type:'concede'}},cb)));assert.equal((await finish).state?.winner,1);
  }finally{a.disconnect();b.disconnect();c?.disconnect();await io.close();}
});
test('two real clients summon and attack through authoritative server, both receive consistent public state',{timeout:20000},async()=>{
  const catalog=loadCatalog('v0.8.0.json'),{http,io}=createDuelServer(catalog);http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}`;
  const a:Client=connect(url,{forceNew:true,transports:['websocket']}),b:Client=connect(url,{forceNew:true,transports:['websocket']});
  const cards=deckCards(catalog,'warrior').filter(c=>c.kind==='minion'&&c.attack>0&&c.cost<=3&&!c.targetRule&&!c.choices).slice(0,15).flatMap(c=>[c.id,c.id]);assert.equal(cards.length,30);
  const deck:Deck={heroClass:'warrior',cards};
  try{
    await Promise.all([waitConnected(a),waitConnected(b)]);const waiting=waitView(a,v=>v.status==='waiting');const session=success(await ack<Session>(cb=>a.emit('room:create',deck,cb)));await waiting;
    const ja=waitView(a,v=>v.state?.phase==='mulligan'),jb=waitView(b,v=>v.state?.phase==='mulligan');success(await ack<Session>(cb=>b.emit('room:join',{code:session.code,deck},cb)));let views=await Promise.all([ja,jb]);
    const act=async(actor:Client,action:Action)=>{const rev=views[0].state!.revision,va=waitView(a,v=>v.state?.revision===rev+1),vb=waitView(b,v=>v.state?.revision===rev+1);success(await ack<RoomView>(cb=>actor.emit('room:action',{revision:rev,action},cb)));views=await Promise.all([va,vb]);return views;};
    await act(a,{type:'mulligan',replace:[]});await act(b,{type:'mulligan',replace:[]});
    for(let i=0;i<4;i++){const actor=views[0].state!.activePlayer===0?a:b;await act(actor,{type:'endTurn'});}
    const seat=views[0].state!.activePlayer,actor=seat===0?a:b,enemy=seat===0?b:a,view=views[seat].state!;
    const card=view.self.hand.find(c=>catalog[c.cardId].kind==='minion'&&catalog[c.cardId].cost<=view.self.mana);assert.ok(card);
    await act(actor,{type:'playCard',instanceId:card.instanceId});const own=views[seat].state!,op=views[seat===0?1:0].state!;assert.ok(own.self.board.some(x=>x.instanceId===card.instanceId));assert.deepEqual(own.self.board,op.opponent.board);assert.ok(!own.self.hand.some(x=>x.instanceId===card.instanceId));
    await act(actor,{type:'endTurn'});await act(enemy,{type:'endTurn'});const m=views[seat].state!.self.board.find(x=>x.instanceId===card.instanceId)!;const hp=views[seat].state!.opponent.health;
    await act(actor,{type:'attack',attackerId:m.instanceId,target:{kind:'hero'}});assert.equal(views[seat].state!.opponent.health,hp-m.attack);assert.equal(views[seat===0?1:0].state!.self.health,hp-m.attack);
    assert.ok(!Object.hasOwn(views[seat].state!.opponent,'hand'));assert.ok(!Object.hasOwn(views[seat].state!.opponent,'deck'));
  }finally{a.disconnect();b.disconnect();await io.close();}
});
test('one real client starts a private AI room and plays until the AI wins',{timeout:20000},async()=>{
  const catalog=loadCatalog(),{http,io}=createDuelServer(catalog,{botDelayMs:1});http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');
  const url=`http://127.0.0.1:${address.port}`,a:Client=connect(url,{forceNew:true,transports:['websocket']}),b:Client=connect(url,{forceNew:true,transports:['websocket']});
  let aiPlayed=false,aiAttacked=false;
  a.on('room:view',v=>{const s=v.state;if(!s)return;if(s.opponent.board.length>0)aiPlayed=true;if(s.self.health<30)aiAttacked=true;assert.ok(!Object.hasOwn(s.opponent,'hand')&&!Object.hasOwn(s.opponent,'deck')&&!Object.hasOwn(s.opponent,'secrets'));});
  try{
    await Promise.all([waitConnected(a),waitConnected(b)]);
    const first=waitView(a,v=>v.state?.phase==='mulligan');
    const session=success(await ack<Session>(cb=>a.emit('room:bot',{deck:starterDeck(catalog,'warrior'),heroClass:'hunter',difficulty:5},cb)));
    const v=await first;assert.equal(v.mode,'bot');assert.equal(v.botDifficulty,5);assert.equal(v.state?.opponent.heroClass,'hunter');assert.equal(v.opponentConnected,true);
    assert.equal((await ack<Session>(cb=>b.emit('room:join',{code:session.code,deck:starterDeck(catalog,'mage')},cb))).ok,false);
    const humanTurn=(v:RoomView)=>v.status==='finished'||v.state?.phase==='playing'&&v.state.activePlayer===0;
    const started=waitView(a,humanTurn);success(await ack<RoomView>(cb=>a.emit('room:action',{revision:v.state!.revision,action:{type:'mulligan',replace:[]}},cb)));let current=await started;
    for(let i=0;i<40&&current.status!=='finished';i++){
      const rev=current.state!.revision,next=waitView(a,v=>humanTurn(v)&&v.state!.revision>rev);
      success(await ack<RoomView>(cb=>a.emit('room:action',{revision:rev,action:{type:'endTurn'}},cb)));current=await next;
    }
    assert.equal(current.status,'finished');assert.equal(current.state?.winner,1);assert.ok(aiPlayed&&aiAttacked);
    success(await ack<null>(cb=>a.emit('room:leave',cb)));
    assert.equal((await ack<Session>(cb=>a.emit('room:resume',{code:session.code,token:session.token},cb))).ok,false);
  }finally{a.disconnect();b.disconnect();await io.close();}
});
test('private deck choice travels only to its owner across real sockets and reconnection',{timeout:20000},async()=>{
  const catalog=loadCatalog('v0.11.0.json');
  // Use inert, free spells as test-only filler so a full board cannot cause
  // both tracking cards to be burned by an overfilled hand on a random shuffle.
  const fillerIds=deckCards(catalog,'hunter').filter(c=>c.id!=='tracking_trail').slice(0,14).map(c=>c.id);
  for(const id of fillerIds)catalog[id]={id,name:`Test filler ${id}`,kind:'spell',cost:0,description:'Test-only hand filler.',class:'hunter',rarity:'basic',effects:[]};
  const {http,io}=createDuelServer(catalog);http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}`;
  const a:Client=connect(url,{forceNew:true,transports:['websocket']}),b:Client=connect(url,{forceNew:true,transports:['websocket']});let c:Client|undefined;
  const deck:Deck={heroClass:'hunter',cards:['tracking_trail','tracking_trail',...fillerIds.flatMap(id=>[id,id])]};
  try{
    await Promise.all([waitConnected(a),waitConnected(b)]);const wa=waitView(a,v=>v.status==='waiting');const sa=success(await ack<Session>(cb=>a.emit('room:create',deck,cb)));await wa;
    const ja=waitView(a,v=>v.state?.phase==='mulligan'),jb=waitView(b,v=>v.state?.phase==='mulligan');const sb=success(await ack<Session>(cb=>b.emit('room:join',{code:sa.code,deck},cb)));let views=await Promise.all([ja,jb]);
    const act=async(client:Client,action:Action)=>{const revision=views[0].state!.revision,va=waitView(a,v=>v.state?.revision===revision+1),vb=waitView(b,v=>v.state?.revision===revision+1);success(await ack<RoomView>(cb=>client.emit('room:action',{revision,action},cb)));views=await Promise.all([va,vb]);};
    await act(a,{type:'mulligan',replace:[]});await act(b,{type:'mulligan',replace:[]});
    let seat=views[0].state!.activePlayer;
    // Play an eligible card when needed to make room for the next draw.
    for(let i=0;i<65;i++){
      seat=views[0].state!.activePlayer;const view=views[seat].state!,client=seat===0?a:b;
      const track=view.self.hand.find(x=>x.cardId==='tracking_trail');if(track){await act(client,{type:'playCard',instanceId:track.instanceId});break;}
      for(const filler of view.self.hand.filter(x=>fillerIds.includes(x.cardId)))await act(client,{type:'playCard',instanceId:filler.instanceId});
      await act(client,{type:'endTurn'});
    }
    const own=views[seat].state!,opp=views[seat===0?1:0].state!;assert.ok(own.self.pendingChoice?.length);assert.ok(opp.choicePending);assert.equal(opp.self.pendingChoice,undefined);
    const chosen=own.self.pendingChoice[0],actor=seat===0?a:b,enemy=seat===0?b:a,session=seat===0?sa:sb;
    assert.equal((await ack<RoomView>(cb=>enemy.emit('room:action',{revision:own.revision,action:{type:'chooseDeckCard',instanceId:chosen.instanceId}},cb))).ok,false);
    assert.equal((await ack<RoomView>(cb=>actor.emit('room:action',{revision:own.revision,action:{type:'endTurn'}},cb))).ok,false);
    const offline=waitView(enemy,v=>!v.opponentConnected);actor.disconnect();await offline;c=connect(url,{forceNew:true,transports:['websocket']});await waitConnected(c);
    const rv=waitView(c,v=>v.state?.choicePending===true);success(await ack<Session>(cb=>c!.emit('room:resume',{code:session.code,token:session.token},cb)));assert.deepEqual((await rv).state?.self.pendingChoice,own.self.pendingChoice);
    const selected=waitView(c,v=>v.state?.revision===own.revision+1);success(await ack<RoomView>(cb=>c!.emit('room:action',{revision:own.revision,action:{type:'chooseDeckCard',instanceId:chosen.instanceId}},cb)));const result=(await selected).state!;assert.equal(result.choicePending,undefined);assert.ok(result.self.hand.some(x=>x.instanceId===chosen.instanceId));
  }finally{a.disconnect();b.disconnect();c?.disconnect();await io.close();}
});
test('active roster: real clients hide secret identity and reject forged opponent hand ID',{timeout:20000},async()=>{
  const catalog=loadCatalog('v0.18.0.json'),{http,io}=createDuelServer(catalog);http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}`;
  const a:Client=connect(url,{forceNew:true,transports:['websocket']}),b:Client=connect(url,{forceNew:true,transports:['websocket']});const clients=[a,b];
  const ids=['eye_for_eye','noble_sacrifice','redemption','repentance','dawn_mace','restoring_ray','judgment_hammer','equality','divine_favor','hallowed_ground','wisp','wild_boar','wolf','recruit','silver_squire'];
  const deck:Deck={heroClass:'paladin',cards:ids.flatMap(id=>[id,id])};
  try{
    await Promise.all([waitConnected(a),waitConnected(b)]);const waiting=waitView(a,v=>v.status==='waiting');const session=success(await ack<Session>(cb=>a.emit('room:create',deck,cb)));await waiting;
    const ja=waitView(a,v=>v.state?.phase==='mulligan'),jb=waitView(b,v=>v.state?.phase==='mulligan');success(await ack<Session>(cb=>b.emit('room:join',{code:session.code,deck},cb)));let views=await Promise.all([ja,jb]);
    const act=async(seat:0|1,action:Action)=>{const rev=views[0].state!.revision,va=waitView(a,v=>v.state?.revision===rev+1),vb=waitView(b,v=>v.state?.revision===rev+1);success(await ack<RoomView>(cb=>clients[seat].emit('room:action',{revision:rev,action},cb)));views=await Promise.all([va,vb]);
      for(const n of [0,1] as const){const own=views[n].state!,opp=views[1-n].state!;assert.equal(own.self.handCount,opp.opponent.handCount);assert.equal(own.self.deckCount,opp.opponent.deckCount);assert.deepEqual(own.self.board,opp.opponent.board);assert.ok(!Object.hasOwn(opp.opponent,'hand')&&!Object.hasOwn(opp.opponent,'deck')&&!Object.hasOwn(opp.opponent,'secrets'));for(const c of own.self.hand)assert.ok(!JSON.stringify(opp).includes(c.instanceId));}
    };
    for(const seat of [0,1] as const)await act(seat,{type:'mulligan',replace:views[seat].state!.self.hand.filter(c=>catalog[c.cardId].kind!=='secret').map(c=>c.instanceId)});
    // Both players have 8 legal secrets. Keep hand space by spending non-secret
    // cards; the test does not depend on a particular shuffled starting hand.
    let installed=false;
    for(let i=0;i<42&&!installed;i++){
      const seat=views[0].state!.activePlayer,foe=seat===0?1:0,v=views[seat].state!,client=clients[seat];
      const stolen=views[foe].state!.self.hand[0];if(stolen){const forged=await ack<RoomView>(cb=>client.emit('room:action',{revision:v.revision,action:{type:'playCard',instanceId:stolen.instanceId}},cb));assert.equal(forged.ok,false);}
      const secret=v.self.hand.find(c=>catalog[c.cardId].kind==='secret'&&catalog[c.cardId].cost<=v.self.mana);
      if(secret){await act(seat,{type:'playCard',instanceId:secret.instanceId});const own=views[seat].state!,op=views[foe].state!;assert.ok(own.self.secrets.some(c=>c.instanceId===secret.instanceId));assert.equal(op.opponent.secretCount,1);assert.ok(!JSON.stringify(op).includes(secret.instanceId));assert.ok(!JSON.stringify(op.history).includes(catalog[secret.cardId].name));installed=true;break;}
      const card=v.self.hand.find(c=>{const d=catalog[c.cardId];return d.cost<=v.self.mana&&(d.kind==='weapon'||d.kind==='minion'&&v.self.board.length<7||d.kind==='spell'&&d.id!=='divine_favor');});
      if(card){const def=catalog[card.cardId];await act(seat,{type:'playCard',instanceId:card.instanceId,...(def.kind==='spell'&&def.targetRule?{target:{kind:'hero',player:seat} as const}:{})});}
      await act(seat,{type:'endTurn'});
    }
    assert.ok(installed,'a secret should be installed before fatigue');const seat=views[0].state!.activePlayer;await act(seat,{type:'concede'});assert.equal(views[0].state?.winner,1-seat);assert.equal(views[1].state?.winner,1-seat);
  }finally{a.disconnect();b.disconnect();await io.close();}
});
