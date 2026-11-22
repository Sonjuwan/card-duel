import {validateBotWeights} from '../../packages/engine/src/index.ts';
import {aiWeightFingerprint} from '../server/ai-profile-store.ts';
import {publishedReleaseIdentity,sha256Text as hash} from '../server/release-identity.ts';
import type {ReleaseIdentity} from '../server/release-identity.ts';
import {loadCatalog} from '../server/server.ts';
import {loadGrowth} from '../server/growth-store.ts';
import {io as connect} from 'socket.io-client';
import type {Socket} from 'socket.io-client';
import type {AccountView,DeveloperRuntimeStatus} from '../../packages/account-protocol.ts';
import {decodeAccountView,decodeGrowthView,decodeActivePresence,decodeDeveloperStatus} from '../client/src/account-status.ts';
import type {ClientEvents,ServerEvents,Result} from '../../packages/protocol.ts';
import project from '../../package.json' with {type:'json'};

type Version={version:string;catalogHash:string;growthHash:string};
type Credentials={email:string;password:string};
function requireCheck(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message);}
export function checkGameHeaders(headers:Headers,origin:string){
  const url=new URL(origin),secure=url.protocol==='https:',ws=(secure?'wss://':'ws://')+url.host;
  const directives=(headers.get('content-security-policy')??'').split(';').map(s=>s.trim());
  requireCheck(headers.get('content-type')?.startsWith('text/html')&&directives.includes("frame-ancestors 'none'")&&directives.includes("form-action 'self'")&&directives.includes("connect-src 'self' "+ws),'게임 페이지 또는 출처 보안 헤더 오류');
  requireCheck(headers.get('cross-origin-resource-policy')==='same-origin'&&headers.get('x-content-type-options')==='nosniff','게임 자산 보안 헤더 오류');
  if(secure)requireCheck(/(?:^|;)\s*max-age=31536000(?:;|$)/i.test(headers.get('strict-transport-security')??''),'HTTPS 강제 보안 헤더 오류');
}
/** No patch action here: the operator still authorizes the deployment. */
export function patchReadiness(runtime:DeveloperRuntimeStatus|undefined){
  requireCheck(runtime&&runtime.maintenance===true&&runtime.maintenanceSaved===true&&runtime.maintenanceSaving===false,'배포 준비 미완료: 점검 상태가 저장되지 않았거나 점검이 꺼져 있습니다.');
  requireCheck(runtime.rooms?.accountPlaying===0&&runtime.rooms?.accountWaiting===0,'배포 준비 미완료: 진행 또는 대기 중인 계정 대전이 남아 있습니다.');
  requireCheck(runtime.pendingRoomWrites===0&&runtime.failedRoomWrites===0&&runtime.pendingResults===0,'배포 준비 미완료: 경기 저장 또는 결과 정산이 남아 있습니다.');
  requireCheck(runtime.pendingCredentialChanges===0,'배포 준비 미완료: 진행 중인 비밀번호 변경 또는 복구가 남아 있습니다.');
  requireCheck(runtime.pendingDeckChanges===0,'배포 준비 미완료: 진행 중인 서버 덱 변경이 남아 있습니다.');
  requireCheck(runtime.readyForPatch===true,'배포 준비 미완료: 서버가 준비 완료를 확인하지 않았습니다.');
  return {maintenance:true,accountPlaying:0,accountWaiting:0,pendingRoomWrites:0,failedRoomWrites:0,pendingResults:0,pendingCredentialChanges:0,pendingDeckChanges:0,readyForPatch:true} as const;
}
export function smokeOrigin(value:string){
  let url:URL;try{url=new URL(value);}catch{throw new Error('게임 서버의 정확한 HTTPS 출처를 입력하세요.');}
  const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  requireCheck(url.origin===value&&!url.username&&!url.password&&(url.protocol==='https:'||url.protocol==='http:'&&loopback),'HTTPS 출처 또는 로컬 루프백 HTTP만 허용됩니다. 경로, 쿼리 및 로그인 정보는 포함하지 마세요.');
  return url.origin;
}
/** Public read-only checks; optional existing test account creates two temporary
 * sessions, reads its own profile, then revokes only the sessions it created. */
export async function runOnlineSmoke(url:string,credentials?:Credentials,expectedVersion=project.version,healthTimeoutMs=90000,expected?:ReleaseIdentity,requireReady=false){
  const origin=smokeOrigin(url),sessions:string[]=[],sockets:Socket<ServerEvents,ClientEvents>[]=[];
  requireCheck(!requireReady||credentials,'배포 준비 검사는 기존 테스트 개발자 계정이 필요합니다.');
  const started=performance.now();
  const request=async(path:string,status:number,options:{cookie?:string;body?:unknown;timeout?:number;accountId?:string}={})=>{
    let response:Response;
    try{response=await fetch(origin+path,{method:options.body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(options.timeout??20000),cache:'no-store',headers:{Origin:origin,...(options.cookie?{Cookie:options.cookie}:{}),...(options.accountId?{'X-Card-Duel-Account':options.accountId}:{}),...(options.body===undefined?{}:{'Content-Type':'application/json'})},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});}
    catch{throw new Error(`서버 요청 실패: ${path}`);}
    if(response.status!==status){await response.body?.cancel();throw new Error(`${path}: HTTP ${response.status} (예상 ${status})`);}
    return response;
  };
  const json=async<T>(path:string,status=200,cookie?:string,accountId?:string)=>{const response=await request(path,status,{cookie,accountId});requireCheck(response.headers.get('cache-control')==='no-store',`${path}: no-store 헤더 없음`);try{return await response.json() as T;}catch{throw new Error(`${path}: JSON 응답 오류`);}};
  async function socketCheck(version:Version,cookie?:string){
    const socket:Socket<ServerEvents,ClientEvents>=connect(origin,{autoConnect:false,forceNew:true,reconnection:false,transports:['websocket'],timeout:20000,extraHeaders:{Origin:origin,...(cookie?{Cookie:cookie}:{})}});sockets.push(socket);
    await new Promise<void>((resolve,reject)=>{
      let sawVersion=false,sawCatalog=false,sawMaintenance=false;
      const timer=setTimeout(()=>reject(new Error('실시간 버전/카탈로그/점검 상태 수신 시간 초과')),20000);
      const finish=()=>{if(sawVersion&&sawCatalog&&sawMaintenance){clearTimeout(timer);resolve();}};
      const fail=(message:string)=>{clearTimeout(timer);reject(new Error(message));};
      socket.once('connect_error',()=>fail('WebSocket 연결 실패'));
      socket.once('server:version',value=>{if(value!==version.version)return fail('실시간 버전 불일치');sawVersion=true;finish();});
      socket.once('server:catalog',value=>{if(value!==version.catalogHash)return fail('실시간 카드 버전 불일치');sawCatalog=true;finish();});
      socket.once('server:maintenance',value=>{if(typeof value!=='boolean')return fail('실시간 점검 상태 오류');sawMaintenance=true;finish();});
      socket.connect();
    });
    const result=await new Promise<Result<null>>((resolve,reject)=>socket.timeout(20000).emit('account:watch',(error,value)=>error?reject(new Error('계정 실시간 인증 응답 시간 초과')):resolve(value)));
    requireCheck(cookie?result.ok:!result.ok&&result.code==='sessionInvalid','계정 실시간 인증 결과 불일치');
  }
  let cleanupFailed=false;
  try{
    const health=await request('/healthz',200,{timeout:healthTimeoutMs});requireCheck((await health.json()).ok===true,'서버 healthz 오류');
    const version=await json<Version>('/api/version');requireCheck(version.version===expectedVersion,'배포 게임 버전 불일치');
    requireCheck(/^[0-9a-f]{64}$/.test(version.catalogHash)&&/^[0-9a-f]{64}$/.test(version.growthHash),'카드/성장 버전 해시 오류 또는 계정 서버 비활성');
    if(expected){requireCheck(version.catalogHash===expected.catalogHash,'승인된 배포 카드 해시 불일치');requireCheck(version.growthHash===expected.growthHash,'승인된 배포 성장 해시 불일치');}
    const catalogResponse=await request('/api/catalog',200),catalogText=await catalogResponse.text();
    requireCheck(hash(catalogText)===version.catalogHash&&catalogResponse.headers.get('x-card-duel-catalog')===version.catalogHash,'카드 해시 불일치');
    const cards=JSON.parse(catalogText) as {id:string;collectible?:boolean}[];requireCheck(Array.isArray(cards)&&cards.length>0,'카드 목록 오류');
    const collectibleCards=cards.filter(card=>card.collectible!==false).length;
    const ai=await json<{catalogHash:string;generation:number;weights:unknown}>('/api/ai-profile');
    const weights=validateBotWeights(ai.weights);
    requireCheck(ai.catalogHash===version.catalogHash&&Number.isInteger(ai.generation)&&ai.generation>=0&&weights,'AI 모델 응답 오류');
    if(expected){requireCheck(ai.generation===expected.aiGeneration,'승인된 배포 AI 세대 불일치');requireCheck(aiWeightFingerprint(weights)===expected.aiWeightsHash,'승인된 배포 AI 가중치 불일치');}
    const page=await request('/',200);checkGameHeaders(page.headers,origin);
    const html=await page.text();requireCheck(html.includes('/assets/'),'게임 빌드 자산 누락');
    const capabilities=await json<{emailRecovery:boolean}>('/api/account/capabilities');requireCheck(typeof capabilities.emailRecovery==='boolean','계정 서버 비활성');
    for(const path of ['/api/account/me','/api/account/active-room','/api/account/developer']){const denied=await request(path,401);await denied.body?.cancel();}
    await socketCheck(version);
    let accountCheck:{sessions:2;profilesMatch:true;role:AccountView['role'];growthMatches:true;identityBound:true}|undefined;
    let readiness:ReturnType<typeof patchReadiness>|undefined;
    if(credentials){
      for(let i=0;i<2;i++){
        const response=await request('/api/account/login',200,{body:credentials});
        const cookie=response.headers.get('set-cookie')??'',session=cookie.match(/^duel_account=[0-9a-f]{64}(?=;)/)?.[0];
        // Remember the token immediately, even if another cookie attribute fails.
        if(session)sessions.push(session);
        requireCheck(session&&/; HttpOnly(?:;|$)/i.test(cookie)&&/; SameSite=Strict(?:;|$)/i.test(cookie)&&(!origin.startsWith('https:')||/; Secure(?:;|$)/i.test(cookie)),'인증 세션 쿠키 보안 속성 오류');
        await response.body?.cancel();
      }
      requireCheck(new Set(sessions).size===2,'두 기기의 인증 세션이 분리되지 않았습니다.');
      const [a,b]=await Promise.all(sessions.map(cookie=>json<unknown>('/api/account/me',200,cookie).then(decodeAccountView)));
      requireCheck(!!a.id&&a.id===b.id&&['player','developer'].includes(a.role)&&a.role===b.role&&Number.isInteger(a.profile?.revision)&&JSON.stringify(a.profile)===JSON.stringify(b.profile),'두 로그인 세션의 계정 진행 기록 불일치 (테스트 계정이 다른 기기에서 변경 중인지 확인하세요)');
      const mismatch=await request('/api/account/export',409,{cookie:sessions[0],accountId:a.id+'-different'});await mismatch.body?.cancel();
      const growth=decodeGrowthView(await json<unknown>('/api/account/growth',200,sessions[0],a.id));
      requireCheck(hash(JSON.stringify(growth))===version.growthHash&&growth.ranks.length===25&&growth.questOrder.length===9&&growth.starterIds.length+growth.unlocks.length===collectibleCards,'서버 성장 설정 불일치');
      const presence=decodeActivePresence(await json<unknown>('/api/account/active-room',200,sessions[0],a.id));
      requireCheck(presence===null||!Object.hasOwn(presence,'token')&&!Object.hasOwn(presence,'code'),'활성 대전 정보 오류');
      if(a.role==='developer'){const dev=decodeDeveloperStatus(await json<unknown>('/api/account/developer',200,sessions[0],a.id));requireCheck(dev.role==='developer'&&dev.version===version.version&&dev.growthHash===version.growthHash,'개발자 권한/버전 불일치');}
      else{const denied=await request('/api/account/developer',403,{cookie:sessions[0],accountId:a.id});await denied.body?.cancel();requireCheck(!requireReady,'배포 준비 검사에는 개발자 권한이 필요합니다.');}
      await Promise.all(sessions.map(cookie=>socketCheck(version,cookie)));
      // Check readiness last, so an early status snapshot is not mistaken for
      // final authorization after the other network checks complete.
      if(requireReady){const fresh=decodeDeveloperStatus(await json<unknown>('/api/account/developer',200,sessions[0],a.id));requireCheck(fresh.role==='developer'&&fresh.version===version.version&&fresh.growthHash===version.growthHash,'개발자 권한/버전 불일치');readiness=patchReadiness(fresh.runtime);}
      accountCheck={sessions:2,profilesMatch:true,role:a.role,growthMatches:true,identityBound:true};
    }
    return {version:version.version,catalogHash:version.catalogHash.slice(0,12),growthHash:version.growthHash.slice(0,12),collectibleCards,aiGeneration:ai.generation,aiWeightsHash:aiWeightFingerprint(weights).slice(0,12),releaseMatched:expected?true:'not requested',emailRecovery:capabilities.emailRecovery,websocket:true,guestPrivateApiDenied:true,accountCheck:accountCheck??'not requested',patchReadiness:readiness??'not requested',durationMs:Math.round(performance.now()-started)};
  }finally{
    sockets.forEach(socket=>socket.disconnect());
    for(const cookie of sessions){try{const response=await request('/api/account/logout',200,{cookie,body:{}});await response.body?.cancel();const denied=await request('/api/account/me',401,{cookie});await denied.body?.cancel();}catch{cleanupFailed=true;}}
    if(cleanupFailed)throw new Error('테스트에서 만든 세션의 로그아웃 확인 실패. 테스트 계정의 기존 세션은 수정하지 않았습니다.');
  }
}
if(import.meta.main){
  try{
    const args=process.argv.slice(2);requireCheck(args.length===1||args.length===2&&['--account','--ready'].includes(args[1]),'사용법: npm run online:smoke -- <서버 HTTPS 출처> [--account | --ready]');
    let credentials:Credentials|undefined;
    if(args[1]){const email=process.env.CARD_DUEL_SMOKE_EMAIL,password=process.env.CARD_DUEL_SMOKE_PASSWORD;requireCheck(email&&password,'기존 테스트 계정의 CARD_DUEL_SMOKE_EMAIL/PASSWORD 환경 변수를 설정하세요.');credentials={email,password};}
    const catalog=loadCatalog(),expected=publishedReleaseIdentity(catalog,loadGrowth(catalog));
    console.log(JSON.stringify(await runOnlineSmoke(args[0],credentials,project.version,90000,expected,args[1]==='--ready'),null,2));
  }catch(error){console.error(error instanceof Error?error.message:'배포 확인 실패');process.exitCode=1;}
}
