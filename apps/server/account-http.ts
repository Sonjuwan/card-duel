import {rewardPaths} from '../../packages/reward-road.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { validateDeck } from '../../packages/engine/src/index.ts';
import {createHash} from 'node:crypto';
import type { Catalog, Deck } from '../../packages/engine/src/index.ts';
import type { AccountActiveRoom,AccountDeck,AccountDeckMutation,AccountExport,AccountRole,AccountView,DeveloperRuntimeStatus,DeveloperStatus,GrowthView } from '../../packages/account-protocol.ts';
import { AccountError, normalizeCredentials,normalizeEmail } from './account-store.ts';
import type { AccountBackend } from './account-store.ts';
import project from '../../package.json' with {type:'json'};
import {aiCatalogHash,resolveGameChampion} from './ai-profile-store.ts';

const COOKIE='duel_account';
const JSON_LIMIT=32768;
const SESSION_SECONDS=7*24*60*60;
function requireExpectedAccount(req:IncomingMessage,accountId:string){
  const expected=req.headers['x-card-duel-account'];
  if(expected!==undefined&&expected!==accountId)throw new AccountError(409,'브라우저의 로그인 계정이 변경되었습니다. 최신 계정을 다시 확인하세요.');
}
const reply=(res:ServerResponse,status:number,body:unknown)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(body));
export function tokenFrom(req:IncomingMessage){
  const cookies=(req.headers.cookie??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(COOKIE+'='));
  return cookies.length===1?cookies[0].slice(COOKIE.length+1):'';
}
function cookie(token:string,secure:boolean){return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?SESSION_SECONDS:0}${secure?'; Secure':''}`;}
function sameOrigin(req:IncomingMessage,trustedOrigin?:string){
  if(req.headers['sec-fetch-site']==='cross-site')return false;
  const origin=req.headers.origin;
  if(!origin)return true; // native clients have no automatic browser cookies
  try{const url=new URL(origin);return url.origin===origin&&['http:','https:'].includes(url.protocol)&&(trustedOrigin?origin===trustedOrigin:url.host===req.headers.host);}catch{return false;}
}
async function json(req:IncomingMessage):Promise<unknown>{
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')throw new AccountError(415,'JSON 요청만 허용됩니다.');
  if(Number(req.headers['content-length']??0)>JSON_LIMIT)throw new AccountError(413,'요청 크기가 너무 큽니다.');
  const chunks:Buffer[]=[];let size=0;
  for await(const chunk of req){const b=Buffer.from(chunk);size+=b.length;if(size>JSON_LIMIT)throw new AccountError(413,'요청 크기가 너무 큽니다.');chunks.push(b);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AccountError(400,'잘못된 JSON 요청입니다.');}
}
function deckUpdate(input:unknown,catalog:Catalog,previous:AccountDeck[]){
  if(!input||typeof input!=='object')throw new AccountError(400,'덱 정보를 입력하세요.');
  const {revision,decks}=input as Record<string,unknown>;
  if(typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<0||!Array.isArray(decks)||decks.length>20)throw new AccountError(400,'잘못된 덱 저장 요청입니다.');
  const used=new Set<string>();const result:AccountDeck[]=decks.map(item=>{
    if(!item||typeof item.name!=='string'||!item.name.trim()||item.name.trim().length>40||!item.deck||typeof item.deck!=='object')throw new AccountError(400,'덱 이름 또는 형식이 잘못되었습니다.');
    const name=item.name.trim();if(used.has(name))throw new AccountError(400,'중복 덱 이름입니다.');used.add(name);
    const deck={heroClass:item.deck.heroClass,cards:item.deck.cards} as Deck;
    try{validateDeck(deck,catalog);}catch{
      // A patch may retire or change a card. Preserve an untouched historical
      // deck while allowing the player to fix/delete other entries. Never allow
      // clients to create or modify a currently illegal deck.
      const old=previous.find(entry=>entry.name===name)?.deck;
      if(!old||old.heroClass!==deck.heroClass||!Array.isArray(deck.cards)||deck.cards.length!==old.cards.length||!old.cards.every((id,i)=>id===deck.cards[i]))throw new AccountError(400,'사용할 수 없는 덱입니다.');
    }
    return {name,deck};
  });
  return {revision,decks:result};
}
function sameDeck(a:Deck|null,b:Deck|null){return a===null||b===null?a===b:a.heroClass===b.heroClass&&a.cards.length===b.cards.length&&a.cards.every((id,i)=>id===b.cards[i]);}
function deckMutation(input:unknown,catalog:Catalog):AccountDeckMutation{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new AccountError(400,'잘못된 덱 변경 요청입니다.');
  const {name,expected,deck}=input as Record<string,unknown>;
  if(typeof name!=='string'||!name.trim()||name.trim().length>40||!Object.hasOwn(input,'expected')||!Object.hasOwn(input,'deck')||Object.keys(input).length!==3)throw new AccountError(400,'잘못된 덱 변경 요청입니다.');
  const shape=(value:unknown):Deck|null=>{if(value===null)return null;if(!value||typeof value!=='object'||Array.isArray(value))throw new AccountError(400,'잘못된 덱 형식입니다.');const {heroClass,cards}=value as Record<string,unknown>;if(typeof heroClass!=='string'||!Array.isArray(cards)||cards.length!==30||cards.some(id=>typeof id!=='string'||!id||id.length>150))throw new AccountError(400,'잘못된 덱 형식입니다.');return {heroClass,cards} as Deck;};
  const prior=shape(expected),next=shape(deck);
  if(prior===null&&next===null)throw new AccountError(400,'변경할 덱이 없습니다.');
  // A historic illegal deck is a valid comparison target or deletion target,
  // but cannot be newly created or overwritten with an illegal deck.
  if(next)try{validateDeck(next,catalog);}catch{throw new AccountError(400,'사용할 수 없는 덱입니다.');}
  return {name:name.trim(),expected:prior,deck:next};
}
async function changeOneDeck(backend:AccountBackend,initial:AccountView,token:string,change:AccountDeckMutation){
  let account=initial;
  for(let attempt=0;attempt<5;attempt++){
    const {decks,revision}=account.profile,existing=decks.find(item=>item.name===change.name);
    const current=existing?.deck??null;
    // A retry after an acknowledgement was lost is harmless.
    if(sameDeck(current,change.deck))return {account,changed:false};
    if(!sameDeck(current,change.expected))throw new AccountError(409,'다른 기기에서 같은 덱을 변경했습니다. 최신 저장본을 확인해 주세요.');
    const next=existing?(change.deck?decks.map(item=>item.name===change.name?{name:change.name,deck:change.deck!}:item):decks.filter(item=>item.name!==change.name)):[...decks,{name:change.name,deck:change.deck!}];
    if(next.length>20)throw new AccountError(400,'서버 덱은 최대 20개까지 저장할 수 있습니다.');
    try{return {account:await backend.updateDecks(account.id,revision,next),changed:true};}
    catch(error){if(!(error instanceof AccountError)||error.status!==409)throw error;const latest=await backend.session(token);if(!latest||latest.id!==initial.id)throw new AccountError(401,'로그인이 필요합니다.');account=latest;}
  }
  throw new AccountError(409,'다른 기기와 동기화 중입니다. 잠시 후 다시 시도해 주세요.');
}
export function createAccountHandler(backend:AccountBackend,catalog:Catalog,trustedOrigin?:string,growth?:GrowthView,onLogout?:(token:string)=>void,onRevoke?:(accountId:string)=>void,onChange?:(accountId:string)=>void,runtime?:()=>DeveloperRuntimeStatus,onMaintenance?:(enabled:boolean)=>Promise<void>,activeRoom?:(id:string,role:AccountRole)=>AccountActiveRoom|null,beginAccountChange?:(kind:'credential'|'deck')=>()=>void){
  const secure=trustedOrigin?.startsWith('https://')??false;
  const limits=new Map<string,{until:number;count:number}>();
  let authenticating=0;
  const limited=(req:IncomingMessage,email:string)=>{
    const now=Date.now(); for(const [key,value] of limits)if(value.until<=now)limits.delete(key);
    for(const [key,max] of [[`ip:${req.socket.remoteAddress??'unknown'}`,60],[`email:${email}`,8],['global',300]] as const){let item=limits.get(key);
      if(!item){if(limits.size>=10000)throw new AccountError(429,'요청이 너무 많습니다.',60);item={until:now+60000,count:0};limits.set(key,item);}
      if(++item.count>max)throw new AccountError(429,'로그인 요청이 너무 많습니다. 잠시 기다려 주세요.',Math.max(1,Math.ceil((item.until-now)/1000)));
    }
    if(authenticating>=8)throw new AccountError(429,'인증 서버가 사용 중입니다. 잠시 기다려 주세요.',2);
  };
  return async(req:IncomingMessage,res:ServerResponse,path:string)=>{
    try{
      if(!sameOrigin(req,trustedOrigin))throw new AccountError(403,'허용되지 않은 출처입니다.');
      const method=req.method;
      if(method==='GET'&&path==='/api/account/capabilities'){reply(res,200,{emailRecovery:!!backend.emailRecovery});return;}
      if(method==='POST'&&(path==='/api/account/recovery-request'||path==='/api/account/recovery-complete')){
        if(!backend.emailRecovery||!backend.requestPasswordRecovery||!backend.completePasswordRecovery)throw new AccountError(403,'이메일 복구가 활성화되지 않았습니다.');
        const input=await json(req);if(!input||typeof input!=='object')throw new AccountError(400,'이메일을 확인하세요.');
        const {email,code,newPassword}=input as Record<string,unknown>,identity=normalizeEmail(email);limited(req,identity);authenticating++;
        try{if(path.endsWith('request'))await backend.requestPasswordRecovery(identity);else{
          if(typeof code!=='string')throw new AccountError(400,'인증 코드를 확인하세요.');const credentials=normalizeCredentials({email:identity,password:newPassword});const finish=beginAccountChange?.('credential');try{let notified=false;const revoke=(id:string)=>{if(!notified){notified=true;onRevoke?.(id);}};const id=await backend.completePasswordRecovery(identity,code,credentials.password,revoke);revoke(id);res.setHeader('Set-Cookie',cookie('',secure));}finally{finish?.();}
        }reply(res,200,{ok:true});return;}finally{authenticating--;}
      }
      if(method==='POST'&&(path==='/api/account/register'||path==='/api/account/login')){
        const {email,password}=normalizeCredentials(await json(req));limited(req,email);authenticating++;
        try{const result=path.endsWith('/register')?await backend.register(email,password):await backend.login(email,password);
          if('verificationRequired'in result){reply(res,202,result);return;}
          res.setHeader('Set-Cookie',cookie(result.token,secure));reply(res,path.endsWith('/register')?201:200,result.account);return;
        }finally{authenticating--;}
      }
      const token=tokenFrom(req);
      if(method==='POST'&&path==='/api/account/logout'){
        await json(req);if(token){if(req.headers['x-card-duel-account']!==undefined){const owner=await backend.sessionOwner(token);if(owner)requireExpectedAccount(req,owner);}try{await backend.logout(token);}finally{onLogout?.(token);}}res.setHeader('Set-Cookie',cookie('',secure));reply(res,200,{ok:true});return;
      }
      const account=token?await backend.session(token):null;
      if(!account)throw new AccountError(401,'로그인이 필요합니다.');
      requireExpectedAccount(req,account.id);
      if(method==='GET'&&path==='/api/account/me'){reply(res,200,account);return;}
      if(method==='GET'&&path==='/api/account/active-room'){reply(res,200,{room:activeRoom?.(account.id,account.role)??null});return;}
      if(method==='GET'&&path==='/api/account/export'){
        const record:AccountExport={schemaVersion:1,gameVersion:project.version,exportedAt:new Date().toISOString(),profile:account.profile};
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Disposition':'attachment; filename="card-duel-progress.json"','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(record,null,2));return;
      }
      if(method==='GET'&&path==='/api/account/growth'&&growth){reply(res,200,growth);return;}
      if(method==='PUT'&&path==='/api/account/reward-path'&&growth&&backend.updateRewardPath){
        const input=await json(req);
        const pathId=input&&typeof input==='object'?(input as {pathId?:unknown}).pathId:undefined;
        if(typeof pathId!=='string'||!rewardPaths(growth).some(path=>path.id===pathId))throw new AccountError(400,'사용할 수 없는 보상의 길입니다.');
        const finish=beginAccountChange?.('deck');
        try{const updated=await backend.updateRewardPath(account.id,pathId,growth);reply(res,200,updated);onChange?.(account.id);return;}finally{finish?.();}
      }
      if(method==='POST'&&path==='/api/account/password'){
        const input=await json(req);if(!input||typeof input!=='object')throw new AccountError(400,'비밀번호를 확인하세요.');
        const {currentPassword,newPassword}=input as Record<string,unknown>;const old=normalizeCredentials({email:account.email,password:currentPassword}),next=normalizeCredentials({email:account.email,password:newPassword});limited(req,account.email);authenticating++;
        try{const finish=beginAccountChange?.('credential');try{let notified=false;const revoke=(id:string)=>{if(!notified){notified=true;onRevoke?.(id);}};await backend.changePassword(account.id,account.email,old.password,next.password,revoke);revoke(account.id);res.setHeader('Set-Cookie',cookie('',secure));reply(res,200,{ok:true});return;}finally{finish?.();}}finally{authenticating--;}
      }
      if(method==='PUT'&&path==='/api/account/decks'){
        const update=deckUpdate(await json(req),catalog,account.profile.decks),finish=beginAccountChange?.('deck');try{const updated=await backend.updateDecks(account.id,update.revision,update.decks);reply(res,200,updated);onChange?.(account.id);return;}finally{finish?.();}
      }
      if(method==='PUT'&&path==='/api/account/deck'){
        const change=deckMutation(await json(req),catalog),finish=beginAccountChange?.('deck');try{const result=await changeOneDeck(backend,account,token,change);reply(res,200,result.account);if(result.changed)onChange?.(account.id);return;}finally{finish?.();}
      }
      if(method==='GET'&&path==='/api/account/developer'){
        if(account.role!=='developer')throw new AccountError(403,'개발자 권한이 필요합니다.');
        const catalogHash=aiCatalogHash(catalog),model=resolveGameChampion(catalogHash);
        const status:DeveloperStatus={role:'developer',version:project.version,collectible:Object.values(catalog).filter(c=>c.kind!=='coin'&&c.collectible!==false).length,rankCount:growth?.ranks.length??0,growthHash:growth?createHash('sha256').update(JSON.stringify(growth)).digest('hex'):undefined,runtime:runtime?.(),aiModel:{source:model?.source??'default',catalogHash,games:model?.champion.games??0,promotions:model?.champion.promotions??0}};reply(res,200,status);return;
      }
      if(method==='POST'&&path==='/api/account/developer/maintenance'){
        if(account.role!=='developer')throw new AccountError(403,'개발자 권한이 필요합니다.');
        const input=await json(req);
        if(!input||typeof input!=='object'||Object.keys(input).length!==1||typeof (input as {enabled?:unknown}).enabled!=='boolean')throw new AccountError(400,'점검 모드 설정이 잘못되었습니다.');
        if(!onMaintenance)throw new AccountError(503,'점검 모드를 사용할 수 없습니다.');
        const enabled=(input as {enabled:boolean}).enabled;await onMaintenance(enabled);reply(res,200,{enabled});return;
      }
      throw new AccountError(404,'존재하지 않는 계정 API입니다.');
    }catch(error){if(res.headersSent||res.destroyed)return;if(error instanceof AccountError){if(error.status===429)res.setHeader('Retry-After',String(error.retryAfterSeconds??60));reply(res,error.status,{error:error.message});}else{console.error('Account request failed');reply(res,500,{error:'계정 서버 오류가 발생했습니다.'});}}
  };
}
