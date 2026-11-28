import {basicDeck} from '../../packages/basic-decks.ts';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import type {Action,Catalog,HeroClass} from '../../packages/engine/src/index.ts';
import type {AccountView,GrowthView} from '../../packages/account-protocol.ts';
import {decodeAccountView,decodeActivePresence} from '../client/src/account-status.ts';
import type {ClientEvents,ServerEvents,Result,RoomView,Session} from '../../packages/protocol.ts';
import {mergeRoomView} from '../client/src/storage.ts';
import {loadCatalog} from '../server/server.ts';
import {loadGrowth} from '../server/growth-store.ts';
import {publishedReleaseIdentity} from '../server/release-identity.ts';
import type {ReleaseIdentity} from '../server/release-identity.ts';
import {runOnlineSmoke,smokeOrigin} from './online-smoke.ts';
import project from '../../package.json' with {type:'json'};

type Credentials={email:string;password:string};
type Client=Socket<ServerEvents,ClientEvents>;
function check(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message);}
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function fresh(account:AccountView,growth:GrowthView){const p=account.profile;return account.role==='player'&&p.xp===0&&p.rank===1&&p.rankWins===0&&p.questGames===0&&p.decks.length===0&&!p.recentMatches?.length&&(!p.matchStats||Object.values(p.matchStats).every(stats=>stats.wins+stats.losses+stats.draws===0))&&same([...p.ownedCards].sort(),[...growth.starterIds].sort());}

/** Explicitly writes to TWO new disposable accounts only. Never register,
 * delete accounts, change maintenance, or alter existing sessions. */
export async function runOnlineAcceptance(url:string,credentialsA:Credentials,credentialsB:Credentials,catalog:Catalog,growth:GrowthView,expected:ReleaseIdentity,allowDisposableWrites=false){
  check(allowDisposableWrites,'폐기 가능한 신규 시험 계정 두 개에 쓰는 명시적 동의가 필요합니다.');
  check(credentialsA.email.trim().toLowerCase()!==credentialsB.email.trim().toLowerCase(),'서로 다른 신규 시험 계정 두 개가 필요합니다.');
  const origin=smokeOrigin(url),accountIds=new Map<string,string>(),sessions:string[]=[],clients:Client[]=[],latest=new Map<Client,RoomView>();
  const started=performance.now();
  const request=async(path:string,status:number,options:{cookie?:string;body?:unknown;method?:string;accountId?:string}={})=>{
    let response:Response;
    try{response=await fetch(origin+path,{method:options.method??(options.body===undefined?'GET':'POST'),redirect:'error',signal:AbortSignal.timeout(30000),cache:'no-store',headers:{Origin:origin,...(options.cookie?{Cookie:options.cookie}:{}),...(options.accountId?{'X-Card-Duel-Account':options.accountId}:{}),...(options.body===undefined?{}:{'Content-Type':'application/json'})},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});}catch{throw new Error(`시험 서버 요청 실패: ${path}`);}
    if(response.status!==status){await response.body?.cancel();throw new Error(`${path}: HTTP ${response.status} (예상 ${status})`);}return response;
  };
  const me=async(cookie:string)=>{const expected=accountIds.get(cookie),value=decodeAccountView(await (await request('/api/account/me',200,{cookie,accountId:expected})).json());check(!expected||value.id===expected,'시험 계정 응답 식별자 불일치');accountIds.set(cookie,value.id);return value;};
  const presence=async(cookie:string)=>({room:decodeActivePresence(await (await request('/api/account/active-room',200,{cookie,accountId:accountIds.get(cookie)})).json())});
  async function login(credentials:Credentials){const response=await request('/api/account/login',200,{body:credentials}),cookie=response.headers.get('set-cookie')?.match(/^duel_account=[0-9a-f]{64}(?=;)/)?.[0];check(cookie,'시험 세션 발급 실패');sessions.push(cookie);await response.body?.cancel();return cookie;}
  const updateView=(socket:Client,view:RoomView)=>latest.set(socket,mergeRoomView(latest.get(socket)??null,view));
  const ack=<T>(send:(reply:(result:Result<T>)=>void)=>void)=>new Promise<Result<T>>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('대전 응답 시간 초과')),30000);send(result=>{clearTimeout(timer);resolve(result);});});
  const ok=<T>(result:Result<T>,step:string)=>{check(result.ok,`${step}: 대전 요청 실패`);return result.data;};
  async function wait<T>(read:()=>T|undefined,description:string,timeout=90000){const until=Date.now()+timeout;while(Date.now()<until){const value=read();if(value!==undefined)return value;await pause(50);}throw new Error(`${description}: 수신 시간 초과`);}
  async function open(cookie:string){
    const socket:Client=connect(origin,{autoConnect:false,forceNew:true,reconnection:false,transports:['websocket'],timeout:30000,extraHeaders:{Origin:origin,Cookie:cookie}});clients.push(socket);
    socket.on('room:view',view=>updateView(socket,view));
    let maintenance:boolean|undefined,version:string|undefined,cardHash:string|undefined;
    socket.on('server:maintenance',value=>maintenance=value);socket.on('server:version',value=>version=value);socket.on('server:catalog',value=>cardHash=value);
    socket.connect();await wait(()=>socket.connected&&maintenance!==undefined&&version!==undefined&&cardHash!==undefined?true:undefined,'시험 소켓 연결',30000);
    check(maintenance===false,'서버 점검 중에는 대전 승인 시험을 실행할 수 없습니다.');check(version===project.version&&cardHash===expected.catalogHash,'시험 중 서버 배포 버전이 변경되었습니다.');
    ok(await ack<null>(reply=>socket.emit('account:watch',reply)),'계정 동기화');return socket;
  }
  async function sync(socket:Client){const view=ok(await ack<RoomView>(reply=>socket.emit('room:sync',reply)),'대전 동기화');updateView(socket,view);return latest.get(socket)!;}
  async function act(socket:Client,action:Action){
    for(let retry=0;retry<8;retry++){
      const view=await sync(socket);check(view.state,'대전 상태 누락');const result=await ack<RoomView>(reply=>socket.emit('room:action',{revision:view.state!.revision,action},reply));
      if(result.ok){updateView(socket,result.data);return latest.get(socket)!;}if(result.code!=='staleRevision'&&result.code!=='rateLimit')throw new Error('시험 대전 행동 거절');await pause(250);
    }throw new Error('시험 대전 행동 재시도 한도');
  }
  const leave=async(socket:Client)=>{ok(await ack<null>(reply=>socket.emit('room:leave',reply)),'대전 종료');latest.delete(socket);};
  try{
    await runOnlineSmoke(origin,undefined,project.version,90000,expected);
    const pcCookie=await login(credentialsA),phoneCookie=await login(credentialsA),otherCookie=await login(credentialsB);
    check(new Set(sessions).size===3,'독립 기기 세션 발급 실패');
    const [pcAccount,phoneAccount,otherAccount]=await Promise.all([me(pcCookie),me(phoneCookie),me(otherCookie)]);
    check(pcAccount.id===phoneAccount.id&&pcAccount.id!==otherAccount.id&&same(pcAccount.profile,phoneAccount.profile),'계정 분리 또는 동기화 오류');
    check(fresh(pcAccount,growth)&&fresh(otherAccount,growth),'시험 계정에 기존 진행 기록 또는 보관 덱이 있습니다. 신규 폐기 가능 유저 계정만 사용하세요.');
    check((await presence(pcCookie)).room===null&&(await presence(otherCookie)).room===null,'시험 계정에 진행 중인 대전이 있습니다.');
    const pc=await open(pcCookie),phone=await open(phoneCookie),other=await open(otherCookie);
    // Three authenticated clients solely for the designated disposable users.
    const hero=growth.questOrder[0] as HeroClass,deck=basicDeck(catalog,hero),name='배포 승인 시험 덱';
    // Deliberately pair the wrong displayed identity with test account B's cookie.
    await (await request('/api/account/export',409,{cookie:otherCookie,accountId:pcAccount.id})).body?.cancel();
    await (await request('/api/account/deck',409,{cookie:otherCookie,method:'PUT',accountId:pcAccount.id,body:{name,expected:null,deck}})).body?.cancel();
    check(same((await me(otherCookie)).profile,otherAccount.profile),'다른 계정의 진행 기록이 변경되었습니다.');
    const wrongSocket=await ack<Session>(reply=>pc.emit('room:ranked',{deck,expectedAccountId:otherAccount.id},reply));check(!wrongSocket.ok&&wrongSocket.code==='accountChanged','다른 표시 계정으로 대전 진입이 허용되었습니다.');
    check((await presence(pcCookie)).room===null&&(await presence(otherCookie)).room===null,'잘못된 대전 진입으로 활성 경기가 생성되었습니다.');
    let changed=false;phone.once('account:changed',()=>changed=true);
    await (await request('/api/account/deck',200,{cookie:pcCookie,accountId:pcAccount.id,method:'PUT',body:{name,expected:null,deck}})).body?.cancel();
    await wait(()=>changed?true:undefined,'다른 기기 덱 변경 알림',30000);
    check(same((await me(phoneCookie)).profile.decks,[{name,deck}])&&(await me(otherCookie)).profile.decks.length===0,'덱 동기화 또는 타계정 분리 오류');
    const match=ok(await ack<Session>(reply=>pc.emit('room:ranked',{deck,expectedAccountId:pcAccount.id},reply)),'랭크 AI 시작');
    const before=await sync(pc);check(before.state&&before.ranked?.rank===1&&before.botDifficulty===1,'첫 랭크 AI 설정 불일치');
    ok(await ack<null>(reply=>pc.emit('room:account-pause',reply)),'계정 AI 저장');latest.delete(pc);
    const saved=await presence(phoneCookie);check(saved.room?.mode==='ranked'&&saved.room.resumeAllowed===true&&saved.room.connected===false,'다른 기기 저장 경기 조회 실패');
    const resumed=ok(await ack<Session>(reply=>phone.emit('room:account-resume',{expectedAccountId:phoneAccount.id},reply)),'다른 기기 이어하기');check(resumed.code===match.code,'이어하기 경기 불일치');
    const restored=await sync(phone);check(restored.state&&restored.state.revision===before.state.revision&&same(restored.state,before.state),'이어하기 경기 상태 불일치');
    await act(phone,{type:'mulligan',replace:[]});
    for(let round=0;round<8;round++){
      const view=await wait(()=>{const value=latest.get(phone);return value?.state&&(value.state.phase==='finished'||value.state.phase==='playing'&&value.state.activePlayer===value.seat)?value:undefined;},'랭크 AI 턴');
      if(view.state!.phase==='finished')break;
      if(view.state!.turn>=6){await act(phone,{type:'concede'});break;}
      await act(phone,{type:'endTurn'});
    }
    const finished=await wait(()=>{const value=latest.get(phone);return value?.state?.phase==='finished'&&value.ranked?.reward!=='pending'?value:undefined;},'랭크 AI 정산');
    check(finished.ranked?.reward==='saved'&&finished.ranked.rewardDetails&&finished.ranked.rewardDetails.xp>0,'랭크 XP 정산 실패');
    const afterRank=await me(phoneCookie);check(afterRank.profile.xp===finished.ranked.rewardDetails.xp&&afterRank.profile.questGames===1&&afterRank.profile.recentMatches?.length===1&&same(afterRank.profile,(await me(pcCookie)).profile),'XP·퀘스트 기기 동기화 오류');
    await leave(phone);
    const pvp=ok(await ack<Session>(reply=>phone.emit('room:owned-create',{deck,expectedAccountId:phoneAccount.id},reply)),'보유 카드 PvP 시작');
    ok(await ack<Session>(reply=>other.emit('room:owned-join',{code:pvp.code,deck,expectedAccountId:otherAccount.id},reply)),'상대 계정 PvP 참가');
    await act(phone,{type:'mulligan',replace:[]});await act(other,{type:'mulligan',replace:[]});
    const ready=await sync(phone);check(ready.state?.phase==='playing'&&ready.ownedPvp,'PvP 시작 상태 오류');
    await act(ready.state.activePlayer===ready.seat?phone:other,{type:'endTurn'});
    const [left,right]=await Promise.all([sync(phone),sync(other)]);check(left.state?.revision===right.state?.revision&&left.seat!==right.seat,'PvP 양쪽 상태 불일치');
    await act(phone,{type:'concede'});
    await wait(()=>latest.get(phone)?.pvpReward==='saved'&&latest.get(other)?.pvpReward==='saved'?true:undefined,'PvP 양측 정산');
    const [finalA,finalB]=await Promise.all([me(phoneCookie),me(otherCookie)]);
    check(finalA.profile.xp===afterRank.profile.xp&&finalB.profile.xp===0&&finalA.profile.matchStats?.pvp.losses===1&&finalB.profile.matchStats?.pvp.wins===1&&same(finalA.profile,(await me(pcCookie)).profile),'PvP 전적 또는 랭크 XP 분리 오류');
    await leave(phone);await leave(other);
    return {version:project.version,disposableAccounts:2,independentSessions:3,deckSynced:true,accountIsolated:true,identityBound:true,resumedRanked:true,xp:finalA.profile.xp,questGames:finalA.profile.questGames,pvpSettled:true,elapsedMs:Math.round(performance.now()-started),note:'시험 계정 기록은 남으며 실제 물리 기기·브라우저 검사는 별도 필요합니다.'};
  }finally{
    clients.forEach(socket=>socket.disconnect());let failed=false;
    for(const cookie of sessions)try{await (await request('/api/account/logout',200,{cookie,accountId:accountIds.get(cookie),body:{}})).body?.cancel();await (await request('/api/account/me',401,{cookie})).body?.cancel();}catch{failed=true;}
    if(failed)throw new Error('시험에서 만든 세션의 로그아웃 확인 실패. 기존 세션은 변경하지 않았습니다.');
  }
}
if(import.meta.main){
  try{
    const args=process.argv.slice(2);check(args.length===2&&args[1]==='--disposable-test-accounts','사용법: npm run online:acceptance -- <HTTPS 출처> --disposable-test-accounts');
    const a={email:process.env.CARD_DUEL_TEST_A_EMAIL??'',password:process.env.CARD_DUEL_TEST_A_PASSWORD??''},b={email:process.env.CARD_DUEL_TEST_B_EMAIL??'',password:process.env.CARD_DUEL_TEST_B_PASSWORD??''};check(a.email&&a.password&&b.email&&b.password,'신규 폐기 가능 시험 계정 A/B의 환경 변수를 설정하세요.');
    const catalog=loadCatalog(),growth=loadGrowth(catalog);
    console.log(JSON.stringify(await runOnlineAcceptance(args[0],a,b,catalog,growth,publishedReleaseIdentity(catalog,growth),true),null,2));
  }catch(error){console.error(error instanceof Error?error.message:'배포 승인 시험 실패');process.exitCode=1;}
}
