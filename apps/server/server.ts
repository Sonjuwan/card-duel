import { createServer } from 'node:http';
import {catalogPayload,sha256Text} from './release-identity.ts';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RuleError,DEFAULT_BOT_WEIGHTS } from '../../packages/engine/src/index.ts';
import type { Catalog } from '../../packages/engine/src/index.ts';
import type { ClientEvents, ServerEvents, Result } from '../../packages/protocol.ts';
import { RoomService,RoomError,resultKey } from './rooms.ts';
import type {RoomOptions,AccountRoomSnapshot} from './rooms.ts';
import { CardStore } from './card-store.ts';
import {aiCatalogHash,readGameChampion} from './ai-profile-store.ts';
import {createAccountHandler,tokenFrom} from './account-http.ts';
import {gameSecurityHeaders} from './security-headers.ts';
import type {AccountBackend} from './account-store.ts';
import {AccountError} from './account-store.ts';
import type {AccountActiveRoom,AccountRole,AccountView,GrowthView} from '../../packages/account-protocol.ts';
import {buildGrowth} from '../../packages/progression.ts';
import type {BotExecutor} from './bot-executor.ts';
import project from '../../package.json' with {type:'json'};
const publicDir=fileURLToPath(new URL('../../dist/client/',import.meta.url));
const MIME:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json; charset=utf-8'};
export function createDuelServer(catalog:Catalog,options:{trustedOrigin?:string;botDelayMs?:number;roomOptions?:RoomOptions;sweepMs?:number;accounts?:AccountBackend;growth?:GrowthView;restoreRooms?:AccountRoomSnapshot[];botExecutor?:BotExecutor;maintenance?:boolean;accountRecheckMs?:number}={}){
  let maintenance=options.maintenance===true,maintenanceSaving=false,maintenanceSaved=true;
  const pendingAccountChanges={credential:0,deck:0};
  const beginAccountChange=(kind:'credential'|'deck')=>{if(maintenance)throw new AccountError(503,kind==='credential'?'서버 점검 중에는 비밀번호를 변경하거나 재설정할 수 없습니다. 점검 종료 후 다시 시도하세요.':'서버 점검 중에는 덱을 서버에 저장하거나 삭제할 수 없습니다. 현재 기기에서 편집은 계속할 수 있습니다.');pendingAccountChanges[kind]++;let ended=false;return()=>{if(!ended){ended=true;pendingAccountChanges[kind]--;}};};
  const requireAccountMatchOpen=()=>{if(maintenance)throw new RuleError('서버 점검 중입니다. 신규 계정 대전은 잠시 중단되며 기존 대전은 이어할 수 있습니다.');};
  const trustedOrigin=options.trustedOrigin;
  if(trustedOrigin){const url=new URL(trustedOrigin);if(!['http:','https:'].includes(url.protocol)||url.origin!==trustedOrigin)throw new Error('CARD_DUEL_PUBLIC_ORIGIN에는 경로 없는 정확한 http(s) 출처를 입력하세요.');}
  const rooms=new RoomService(catalog,options.roomOptions);
  const catalogJson=catalogPayload(rooms.catalog);
  const catalogHash=sha256Text(catalogJson);
  const trainingHash=aiCatalogHash(rooms.catalog);
  const durableSignatures=new Map<string,string>(),durablePending=new Map<string,Set<string>>();
  const pendingSaves=new Map<string,{signature:string;promise:Promise<void>}>(),failedSaves=new Set<string>();
  for(const snapshot of options.restoreRooms??[]){if(durableSignatures.has(snapshot.code))throw new Error('Duplicate stored account snapshot');rooms.restoreAccountSnapshot(snapshot,catalogHash);durableSignatures.set(snapshot.code,JSON.stringify(snapshot));durablePending.set(snapshot.code,new Set(snapshot.pending.map(resultKey)));}
  function persistRoom(code:string):Promise<void>|undefined{
    if(!options.accounts)return undefined;
    const snapshot=rooms.accountSnapshot(code,catalogHash),signature=snapshot?JSON.stringify(snapshot):'';
    const queued=pendingSaves.get(code);
    if(queued?.signature===signature)return queued.promise;
    if(!queued&&(durableSignatures.get(code)??'')===signature){failedSaves.delete(code);return undefined;}
    const backend=options.accounts;
    const task=(queued?.promise.catch(()=>{})??Promise.resolve()).then(async()=>{
      if((durableSignatures.get(code)??'')===signature)return;
      if(snapshot){await backend.saveRoomSnapshot(snapshot);durableSignatures.set(code,signature);durablePending.set(code,new Set(snapshot.pending.map(resultKey)));}
      else{await backend.deleteRoomSnapshot(code);durableSignatures.delete(code);durablePending.delete(code);}
    }).then(()=>{failedSaves.delete(code);}).catch(error=>{failedSaves.add(code);throw error;}).finally(()=>{if(pendingSaves.get(code)?.promise===task)pendingSaves.delete(code);});
    pendingSaves.set(code,{signature,promise:task});return task;
  }
  const growth=options.accounts?(options.growth??buildGrowth(rooms.catalog)):undefined;
  const growthHash=growth?sha256Text(JSON.stringify(growth)):undefined;
  const authenticatedSockets=new Map<string,string>();
  let accountRevocationGeneration=0;
  // Publish presence only once the corresponding durable room write succeeds.
  const presenceByRoom=new Map(rooms.accountSnapshotCodes().map(code=>[code,rooms.accountRoomEntries(code)]));
  const activeRoom=(id:string,role:AccountRole):AccountActiveRoom|null=>{
    for(const members of presenceByRoom.values()){const entry=members.get(id);if(entry)return{...entry,resumeAllowed:entry.mode!=='developer-test'||role==='developer'};}
    return null;
  };
  const notifyRoomPresence=(code:string)=>{
    const previous=presenceByRoom.get(code)??new Map(),next=rooms.accountRoomEntries(code);
    if(next.size)presenceByRoom.set(code,next);else presenceByRoom.delete(code);
    for(const id of new Set([...previous.keys(),...next.keys()]))if(JSON.stringify(previous.get(id))!==JSON.stringify(next.get(id))){
      for(const [socketId,accountId]of authenticatedSockets)if(id===accountId)io.to(socketId).emit('account:room-changed');
    }
  };
  // This event deliberately contains no account data: every receiver must fetch
  // its own authenticated profile, and nonmatching accounts never see it.
  const notifyAccount=(id:string)=>{for(const [socketId,accountId]of authenticatedSockets)if(id===accountId)io.to(socketId).emit('account:changed');};
  const publishMaintenance=(enabled:boolean)=>{if(maintenance!==enabled){maintenance=enabled;io.emit('server:maintenance',enabled);}};
  const setMaintenance=async(enabled:boolean)=>{
    if(maintenanceSaving)throw new AccountError(409,'점검 상태 저장 중입니다. 잠시 후 다시 시도하세요.');
    if(maintenance===enabled&&maintenanceSaved)return;
    maintenanceSaving=true;
    // Close admission before a write to enable maintenance, and do not reopen
    // admission until a successful write explicitly disables maintenance.
    if(enabled)publishMaintenance(true);
    try{await options.accounts!.setMaintenance(enabled);maintenanceSaved=true;publishMaintenance(enabled);}
    catch{maintenanceSaved=false;publishMaintenance(true);throw new AccountError(503,'점검 상태 저장에 실패했습니다. 신규 대전은 임시 차단되며 저장 재시도가 필요합니다. 배포하지 마세요.');}
    finally{maintenanceSaving=false;}
  };
  const accountHandler=options.accounts?createAccountHandler(options.accounts,rooms.catalog,trustedOrigin,growth,token=>{for(const socket of io.sockets.sockets.values())if(tokenFrom(socket.request)===token)socket.disconnect(true);},id=>{accountRevocationGeneration++;for(const [socketId,accountId]of authenticatedSockets)if(id===accountId)io.sockets.sockets.get(socketId)?.disconnect(true);},notifyAccount,()=>{const metrics=rooms.metrics(),pendingResults=rooms.pendingRankedResults().length;return{rooms:metrics,connectedSockets:io.sockets.sockets.size,pendingRoomWrites:pendingSaves.size,failedRoomWrites:failedSaves.size,pendingResults,pendingCredentialChanges:pendingAccountChanges.credential,pendingDeckChanges:pendingAccountChanges.deck,uptimeSeconds:Math.floor(process.uptime()),rssBytes:process.memoryUsage.rss(),maintenance,maintenanceSaving,maintenanceSaved,readyForPatch:maintenance&&maintenanceSaved&&!maintenanceSaving&&metrics.accountPlaying===0&&metrics.accountWaiting===0&&pendingSaves.size===0&&failedSaves.size===0&&pendingResults===0&&pendingAccountChanges.credential===0&&pendingAccountChanges.deck===0,aiWorker:options.botExecutor?.stats?.()};},setMaintenance,activeRoom,beginAccountChange):undefined;
  const http=createServer((req,res)=>{
    for(const [name,value]of Object.entries(gameSecurityHeaders(trustedOrigin,req.headers.host)))res.setHeader(name,value);
    const path=(req.url??'/').split('?')[0];
    if(path.startsWith('/api/account/')){if(accountHandler)void accountHandler(req,res,path);else res.writeHead(503,{'Cache-Control':'no-store','Content-Type':'application/json'}).end(JSON.stringify({error:'계정 서버가 활성화되지 않았습니다.'}));return;}
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
    if(path==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:JSON.stringify({ok:true}));return;}
    if(path==='/api/version'){
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:JSON.stringify({version:project.version,catalogHash,growthHash}));return;
    }
    if(path==='/api/catalog'){
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Card-Duel-Catalog':catalogHash}).end(req.method==='HEAD'?undefined:catalogJson);return;
    }
    if(path==='/api/ai-profile'){
      const model=readGameChampion(trainingHash);
      const body=JSON.stringify({catalogHash,weights:model?.weights??DEFAULT_BOT_WEIGHTS,generation:model?.promotions??0});
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:body);return;
    }
    if(path!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(path)){res.writeHead(404).end('Not found');return;}
    const file=resolve(publicDir,path==='/'?'index.html':path.slice(1));
    if(!file.startsWith(resolve(publicDir)+sep)||!existsSync(file)){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('먼저 npm run build 를 실행하세요.');return;}
    try{const bytes=readFileSync(file);res.writeHead(200,{'Content-Type':MIME[extname(file)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':path==='/'?'no-cache':'public, max-age=31536000, immutable'}).end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(500).end('Server error');}
  });
  http.requestTimeout=30000;http.headersTimeout=15000;
  const io=new Server<ClientEvents,ServerEvents>(http,{maxHttpBufferSize:32768,allowRequest:(req,cb)=>{
    try{const origin=req.headers.origin;if(!origin){cb(null,true);return;}const url=new URL(origin);cb(null,['http:','https:'].includes(url.protocol)&&url.origin===origin&&(trustedOrigin?origin===trustedOrigin:url.host===req.headers.host));}catch{cb(null,false);}
  }});
  const sendView=(code:string)=>{for(const id of rooms.socketsFor(code))io.to(id).emit('room:view',rooms.view(id));};
  const saving=new Map<string,Promise<void>>();let closed=false;
  const settle=()=>{if(!options.accounts||!growth)return;for(const result of rooms.pendingRankedResults()){
    const key=resultKey(result);if(saving.has(key)||!durablePending.get(result.code)?.has(key))continue;
    const task=options.accounts.recordMatch(result.accountId,result.award,growth).then(account=>{const code=rooms.confirmRankedResult(key,account.profile);if(code){if(!closed){sendView(code);notifyAccount(result.accountId);}void persistRoom(code)?.catch(()=>console.error('Saved match snapshot cleanup will retry'));}}).catch(()=>{console.error('Account match persistence failed; will retry');}).finally(()=>{saving.delete(key);});saving.set(key,task);
  }};
  const publish=(code:string)=>{if(pendingSaves.has(code)||failedSaves.has(code))return;settle();if(!closed){notifyRoomPresence(code);sendView(code);scheduleBot(code);scheduleTurn(code);}};
  const broadcast=(code:string)=>{const savingRoom=persistRoom(code);if(savingRoom)void savingRoom.then(()=>publish(code)).catch(()=>{for(const id of rooms.socketsFor(code))io.to(id).emit('room:error','서버 저장이 지연되고 있습니다. 저장 완료 후 대전이 재개됩니다.');});else publish(code);};
  const blocked=(code:string)=>pendingSaves.has(code)||failedSaves.has(code);
  const botTimers=new Map<string,ReturnType<typeof setTimeout>>();
  const botComputing=new Map<string,AbortController>();
  const turnTimers=new Map<string,{deadline:number;timer:ReturnType<typeof setTimeout>}>();
  function scheduleTurn(code:string){
    if(closed||blocked(code))return;
    const deadline=rooms.turnDeadline(code),old=turnTimers.get(code);
    if(old&&old.deadline===deadline)return;
    if(old)clearTimeout(old.timer);turnTimers.delete(code);
    if(deadline===undefined)return;
    const timer=setTimeout(()=>{
      turnTimers.delete(code);
      if(blocked(code))return;
      try{if(rooms.expireTurn(code)){broadcast(code);scheduleBot(code);}}
      catch(e){console.error('Turn timer failed',e);for(const id of rooms.socketsFor(code))io.to(id).emit('room:error','턴 시간 처리 오류가 발생했습니다. 새 대전을 시작해 주세요.');return;}
      scheduleTurn(code);
    },Math.max(1,deadline-Date.now()));timer.unref();turnTimers.set(code,{deadline,timer});
  }
  const scheduleBot=(code:string,retryDelay=0)=>{
    const active=botComputing.get(code);if(active){if(!rooms.botReady(code)||closed)active.abort();return;}
    if(closed||blocked(code))return;
    const existing=botTimers.get(code);
    if(!rooms.botReady(code)){if(existing)clearTimeout(existing);botTimers.delete(code);return;}
    if(existing)return;
    const timer=setTimeout(()=>{
      botTimers.delete(code);
      if(blocked(code))return;
      if(options.botExecutor){
        const executor=options.botExecutor,controller=new AbortController();botComputing.set(code,controller);let failed=false;
        void rooms.stepBotAsync(code,job=>executor.run(job,controller.signal),()=>!closed&&!blocked(code)&&!controller.signal.aborted).then(changed=>{if(changed)broadcast(code);}).catch(()=>{if(!controller.signal.aborted&&!closed&&rooms.botReady(code)){failed=true;for(const id of rooms.socketsFor(code))io.to(id).emit('room:error','AI 계산이 지연되었습니다. 서버에서 다시 시도합니다.');}}).finally(()=>{botComputing.delete(code);scheduleBot(code,failed?500:0);scheduleTurn(code);});return;
      }
      try{if(rooms.stepBot(code)){broadcast(code);scheduleBot(code);scheduleTurn(code);}}
      catch(e){console.error('AI action failed',e);for(const id of rooms.socketsFor(code))io.to(id).emit('room:error','AI 행동 오류가 발생했습니다. 새 대전을 시작해 주세요.');}
    },Math.max(retryDelay,options.botDelayMs??rooms.botDelay(code)));
    timer.unref();botTimers.set(code,timer);
  };
  function sweepRooms(retry=false){
    const {changed,expired,removed}=rooms.sweep();for(const event of expired)io.to(event.socketId).emit('room:expired',{code:event.code,reason:event.reason});
    for(const code of removed){const bot=botTimers.get(code),turn=turnTimers.get(code);if(bot)clearTimeout(bot);if(turn)clearTimeout(turn.timer);botTimers.delete(code);turnTimers.delete(code);botComputing.get(code)?.abort();broadcast(code);}
    for(const code of changed){broadcast(code);scheduleBot(code);scheduleTurn(code);}
    if(retry)for(const code of new Set([...durableSignatures.keys(),...rooms.accountSnapshotCodes(),...failedSaves]))if(!pendingSaves.has(code)){
      const task=persistRoom(code);if(task)void task.then(()=>publish(code)).catch(()=>{});
    }
    settle();
  }
  const sweeper=setInterval(()=>{try{sweepRooms(true);}catch(e){console.error('Room cleanup failed',e);}},options.sweepMs??5000);sweeper.unref();
  http.on('close',()=>{closed=true;clearInterval(sweeper);for(const timer of botTimers.values())clearTimeout(timer);botTimers.clear();for(const {timer} of turnTimers.values())clearTimeout(timer);turnTimers.clear();void options.botExecutor?.close().catch(()=>{});for(const controller of botComputing.values())controller.abort();});
  io.on('connection',socket=>{
    socket.emit('server:version',project.version);
    socket.emit('server:catalog',catalogHash);
    socket.emit('server:maintenance',maintenance);
    let count=0,last=Date.now();
    let authenticating=false;
    let verifiedAccount:{id:string;role:AccountRole;checkedAt:number}|undefined;
    const readSocketAccount=async()=>{const generation=accountRevocationGeneration,token=tokenFrom(socket.request),account=options.accounts&&token?await options.accounts.session(token):null;if(generation!==accountRevocationGeneration)throw new AccountError(503,'계정 인증 상태가 변경되었습니다. 다시 확인하세요.');return account;};
    const rememberAccount=(account:AccountView)=>{verifiedAccount={id:account.id,role:account.role,checkedAt:Date.now()};authenticatedSockets.set(socket.id,account.id);};
    const revokeActiveSeat=(message:string)=>{
      verifiedAccount=undefined;authenticatedSockets.delete(socket.id);
      const code=rooms.disconnect(socket.id);if(code){socket.emit('room:expired',{code,reason:message});broadcast(code);}
      socket.emit('account:changed');
    };
    function rateAllowed(){const now=Date.now();if(now-last>=10000){last=now;count=0;}return ++count<=60;}
    let watching=false;
    socket.on('account:watch',async reply=>{
      if(typeof reply!=='function')return;
      if(watching||!rateAllowed()){reply({ok:false,error:'요청이 너무 많습니다.',code:'rateLimit'});return;}
      watching=true;
      try{const account=await readSocketAccount();if(!socket.connected)return;
        if(!account){verifiedAccount=undefined;authenticatedSockets.delete(socket.id);if(rooms.accountMembership(socket.id))revokeActiveSeat('계정 로그인 세션이 만료되었습니다. 다시 로그인하세요.');reply({ok:false,error:'로그인이 필요합니다.',code:'sessionInvalid'});return;}
        const membership=rooms.accountMembership(socket.id);if(membership&&(membership.accountId!==account.id||membership.developerOnly&&account.role!=='developer'))revokeActiveSeat('현재 계정의 대전 권한이 변경되었습니다.');
        rememberAccount(account);reply({ok:true,data:null});
      }catch{if(socket.connected)reply({ok:false,error:'계정 동기화 연결에 실패했습니다.',code:'serverError'});}finally{watching=false;}
    });
    function guard<T>(reply:(r:Result<T>)=>void,fn:()=>{data:T;code:string},allowPending=false){
      if(typeof reply!=='function')return;
      if(!rateAllowed()){reply({ok:false,error:'요청이 너무 많습니다. 잠시 기다려 주세요.',code:'rateLimit'});return;}
      const current=rooms.socketRoomCode(socket.id);if(current&&!allowPending&&blocked(current)){reply({ok:false,error:'서버 저장 중입니다. 잠시 후 다시 시도하세요.',code:'rateLimit'});return;}
      try{sweepRooms();const {data,code}=fn();for(const event of rooms.takeReplacements())io.to(event.socketId).emit('room:expired',{code:event.code,reason:event.reason});const complete=()=>{if(socket.connected)reply({ok:true,data});publish(code);};
        const persistent=persistRoom(code);if(persistent)void persistent.then(complete).catch(()=>{if(socket.connected)reply({ok:false,error:'서버 저장이 지연됩니다. 연결 재시도 또는 동기화로 복구하세요.',code:'serverError'});});else complete();
      }catch(e){reply({ok:false,error:e instanceof RuleError?e.message:'서버 오류가 발생했습니다.',...(e instanceof RoomError?{code:e.code}:!(e instanceof RuleError)?{code:'serverError' as const}:{})});if(!(e instanceof RuleError))console.error(e);}
    }
    async function withAccount<T>(reply:(r:Result<T>)=>void,fn:(account:AccountView)=>{data:T;code:string},expectedAccountId?:unknown){
      if(typeof reply!=='function')return;
      if(authenticating||!rateAllowed()){reply({ok:false,error:'요청이 너무 많습니다. 잠시 기다려 주세요.',code:'rateLimit'});return;}
      authenticating=true;
      try{const account=await readSocketAccount();
        if(!socket.connected)return;
        if(!account){if(rooms.accountMembership(socket.id))revokeActiveSeat('계정 로그인 세션이 만료되었습니다. 다시 로그인하세요.');else{authenticatedSockets.delete(socket.id);verifiedAccount=undefined;}reply({ok:false,error:'랭크 대전은 계정 로그인이 필요합니다.',code:'sessionInvalid'});return;}
        if(expectedAccountId!==undefined&&expectedAccountId!==account.id){reply({ok:false,error:'대전 연결의 로그인 계정이 변경되었습니다. 계정을 다시 확인하세요.',code:'accountChanged'});return;}
        rememberAccount(account);
        guard(reply,()=>fn(account));
      }catch(error){if(socket.connected)reply({ok:false,error:error instanceof AccountError?error.message:'계정 확인에 실패했습니다.',code:'serverError'});}
      finally{authenticating=false;}
    }
    // Recheck long-lived authenticated room connections without issuing a
    // database request on every card play. HTTP logout/password revocation
    // still disconnects immediately; expired or externally revoked sessions
    // lose the seat at the next recheck before their action can be applied.
    async function guardActive<T>(reply:(r:Result<T>)=>void,fn:()=>{data:T;code:string},allowPending=false){
      if(typeof reply!=='function')return;
      const member=rooms.accountMembership(socket.id);
      if(!member){guard(reply,fn,allowPending);return;}
      const valid=(account:Pick<AccountView,'id'|'role'>|undefined|null)=>account?.id===member.accountId&&(!member.developerOnly||account.role==='developer');
      if(valid(verifiedAccount)&&Date.now()-verifiedAccount!.checkedAt<(options.accountRecheckMs??60000)){guard(reply,fn,allowPending);return;}
      if(authenticating||!rateAllowed()){reply({ok:false,error:'계정 확인 중입니다. 잠시 후 다시 시도하세요.',code:'rateLimit'});return;}
      authenticating=true;
      try{
        const account=await readSocketAccount();
        if(!socket.connected)return;
        const current=rooms.accountMembership(socket.id);
        if(!current||current.code!==member.code||current.accountId!==member.accountId){reply({ok:false,error:'대전 연결이 변경되었습니다.',code:'sessionInvalid'});return;}
        if(!valid(account)){const error='계정 세션 또는 대전 권한이 만료되었습니다. 다시 로그인하세요.';reply({ok:false,error,code:'sessionInvalid'});revokeActiveSeat(error);return;}
        rememberAccount(account!);guard(reply,fn,allowPending);
      }catch(error){if(socket.connected)reply({ok:false,error:error instanceof AccountError?error.message:'계정 확인에 실패했습니다.',code:'serverError'});}
      finally{authenticating=false;}
    }
    socket.on('room:create',(input,reply)=>guard(reply,()=>{const wrapped=input&&typeof input==='object'&&'deck'in input;const data=rooms.withTicket(socket.id,wrapped?input.ticket:undefined,()=>rooms.create(socket.id,wrapped?input.deck:input));return{data,code:data.code};}));
    socket.on('room:bot',(input,reply)=>guard(reply,()=>{const data=rooms.withTicket(socket.id,input?.ticket,()=>rooms.createBot(socket.id,input));return{data,code:data.code};}));
    socket.on('room:ranked',(input,reply)=>{void withAccount(reply,account=>{if(!growth)throw new RuleError('랭크 모드가 활성화되지 않았습니다.');const data=rooms.withTicket(socket.id,input?.ticket,()=>{requireAccountMatchOpen();return rooms.createRanked(socket.id,input,account,growth);},account.id);return{data,code:data.code};},input?.expectedAccountId);});
    socket.on('room:developer-test',(input,reply)=>{void withAccount(reply,account=>{if(!growth||account.role!=='developer')throw new RuleError('개발자 권한이 필요합니다.');const data=rooms.withTicket(socket.id,input?.ticket,()=>{requireAccountMatchOpen();return rooms.createDeveloperTest(socket.id,input,account,growth);},account.id,account.role);return{data,code:data.code};},input?.expectedAccountId);});
    socket.on('room:owned-create',(input,reply)=>{void withAccount(reply,account=>{if(!growth)throw new RuleError('계정 대전이 활성화되지 않았습니다.');const data=rooms.withTicket(socket.id,input?.ticket,()=>{requireAccountMatchOpen();return rooms.createOwnedPvp(socket.id,input,account,growth);},account.id);return{data,code:data.code};},input?.expectedAccountId);});
    socket.on('room:owned-join',(input,reply)=>{void withAccount(reply,account=>{if(!growth)throw new RuleError('계정 대전이 활성화되지 않았습니다.');const data=rooms.withTicket(socket.id,input?.ticket,()=>{requireAccountMatchOpen();return rooms.joinOwnedPvp(socket.id,input,account,growth);},account.id);return{data,code:data.code};},input?.expectedAccountId);});
    socket.on('room:owned-match',(input,reply)=>{void withAccount(reply,account=>{if(!growth)throw new RuleError('계정 대전이 활성화되지 않았습니다.');const data=rooms.withTicket(socket.id,input?.ticket,()=>{requireAccountMatchOpen();return rooms.matchOwnedPvp(socket.id,input,account,growth);},account.id);return{data,code:data.code};},input?.expectedAccountId);});
    socket.on('room:account-resume',(input,reply)=>{void withAccount(reply,account=>{const data=rooms.withTicket(socket.id,input?.ticket,()=>rooms.resumeAccount(socket.id,account.id,account.role),account.id,account.role);return{data,code:data.code};},input?.expectedAccountId);});
    socket.on('room:join',(input,reply)=>guard(reply,()=>{const data=rooms.withTicket(socket.id,input?.ticket,()=>rooms.join(socket.id,input));return{data,code:data.code};}));
    socket.on('room:recover',(input,reply)=>{const restore=(account?:AccountView)=>{const data=rooms.recover(socket.id,input,account?.id,account?.role);return{data,code:data.code};};if(rooms.resumeNeedsAccount(input,true))void withAccount(reply,restore);else guard(reply,()=>restore());});
    socket.on('room:resume',(input,reply)=>{const restore=(account?:AccountView)=>{const data=rooms.resume(socket.id,input,account?.id,account?.role);return{data,code:data.code};};if(rooms.resumeNeedsAccount(input))void withAccount(reply,restore);else guard(reply,()=>restore());});
    socket.on('room:action',(input,reply)=>{void guardActive(reply,()=>{const code=rooms.act(socket.id,input);return{data:rooms.view(socket.id),code};});});
    socket.on('room:sync',reply=>{void guardActive(reply,()=>{const data=rooms.view(socket.id);return{data,code:data.code};},true);});
    socket.on('room:account-pause',reply=>{void guardActive(reply,()=>({data:null,code:rooms.pauseAccount(socket.id)}));});
    socket.on('room:leave',reply=>{void guardActive(reply,()=>({data:null,code:rooms.leave(socket.id)}));});
    socket.on('disconnect',()=>{authenticatedSockets.delete(socket.id);const code=rooms.disconnect(socket.id);if(code){broadcast(code);scheduleBot(code);scheduleTurn(code);}});
  });
  async function flush(){
    for(const code of new Set([...durableSignatures.keys(),...rooms.accountSnapshotCodes(),...failedSaves]))void persistRoom(code)?.catch(()=>{});
    while(pendingSaves.size||saving.size)await Promise.allSettled([...pendingSaves.values()].map(s=>s.promise).concat([...saving.values()]));
    return failedSaves.size===0;
  }
  return {http,io,rooms,flush};
}
export function loadCatalog(version?:string){return new CardStore().read(version).catalog;}
