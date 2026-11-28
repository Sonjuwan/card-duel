import {createHash,randomBytes} from 'node:crypto';
import type {AccountBackend,AccountLogin} from './account-store.ts';
import {AccountError,newProfile,normalizeCredentials,normalizeEmail} from './account-store.ts';
import type {AccountDeck,AccountProfile,AccountRole,AccountView,AccountRegistrationPending,GrowthView,MatchAward} from '../../packages/account-protocol.ts';
import {selectRewardPath} from '../../packages/reward-road.ts';
import {awardMatch,syncOwned} from '../../packages/progression.ts';
import type {AccountRoomSnapshot} from './rooms.ts';
import {decodeAccountProfile} from '../../packages/account-profile.ts';

type Row={id:string;email:string;role:AccountRole;profile:AccountProfile;revision:number};
type SessionRow={account_id:string;expires_at:string};
type AuthResponse={access_token?:string;user?:{id:string;email:string};id?:string;email?:string};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const expires=7*24*3600*1000;
function providerRateLimit(response:Response,message='요청이 너무 많습니다. 잠시 기다려 주세요.'){
  if(response.status!==429)return;
  const raw=response.headers.get('Retry-After')??'',seconds=/^\d+$/.test(raw)?Number(raw):Math.ceil((Date.parse(raw)-Date.now())/1000);
  throw new AccountError(429,message,Number.isFinite(seconds)?Math.min(86400,Math.max(1,seconds)):60);
}
function view(row:Row):AccountView{
  try{
    if(typeof row.id!=='string'||!uuid.test(row.id)||typeof row.email!=='string'||!['player','developer'].includes(row.role)||!Number.isSafeInteger(row.revision)||row.revision<0)throw Error('Invalid account row');
    return{id:row.id,email:row.email,role:row.role,profile:decodeAccountProfile(row.profile,{revision:row.revision,legacyRankWins:true})};
  }catch{throw new AccountError(503,'계정 저장소의 프로필 형식을 확인할 수 없습니다.');}
}
/** Supabase Auth owns passwords; the game owns its opaque, independently revocable sessions. */
export class SupabaseAccountStore implements AccountBackend {
  private readonly base:string;
  private readonly publicKey:string;
  private readonly secretKey:string;
  private readonly fetcher:typeof fetch;
  private readonly growth?:GrowthView;
  private lastSessionCleanup=0;
  private sessionGeneration=0;
  private changing=new Set<string>();private authEpoch=new Map<string,number>();
  readonly emailRecovery:boolean;
  constructor(options:{url:string;publicKey:string;secretKey:string;fetcher?:typeof fetch;growth?:GrowthView;emailRecovery?:boolean}){
    const url=new URL(options.url);if(url.protocol!=='https:'||url.origin!==options.url||!options.publicKey||!options.secretKey)throw new Error('Supabase HTTPS URL과 서버 키를 확인하세요.');
    this.base=url.origin;this.publicKey=options.publicKey;this.secretKey=options.secretKey;this.fetcher=options.fetcher??fetch;this.growth=options.growth;this.emailRecovery=options.emailRecovery===true;
  }
  private view(row:Row){const account=view(row);if(this.growth)account.profile=syncOwned(account.profile,this.growth);return account;}
  private async refresh(row:Row):Promise<AccountView>{
    for(let attempt=0;attempt<5;attempt++){
      const current=view(row),next=this.view(row);if(JSON.stringify(current.profile)===JSON.stringify(next.profile))return next;
      const updated=await this.dbRows<Row>(`duel_accounts?id=eq.${row.id}&revision=eq.${row.revision}`,'PATCH',{profile:next.profile,revision:row.revision+1},'return=representation');
      if(updated.length===1){if(updated[0].id!==row.id)throw new AccountError(503,'계정 저장소의 식별자를 확인할 수 없습니다.');return this.view(updated[0]);}const latest=await this.get(row.id);if(!latest)throw new AccountError(404,'계정이 없습니다.');row=latest;
    }
    throw new AccountError(409,'카드 획득 정보 동기화 중입니다. 다시 시도하세요.');
  }
  private async call(path:string,method:string,key:string,body?:unknown,prefer?:string,bearer?:string):Promise<Response>{
    try{return await this.fetcher(this.base+path,{method,redirect:'error',signal:AbortSignal.timeout(12000),headers:{apikey:key,...(bearer||key.startsWith('eyJ')?{Authorization:`Bearer ${bearer??key}`}:{ }),...(body!==undefined?{'Content-Type':'application/json'}:{}),...(prefer?{Prefer:prefer}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});}
    catch{throw new AccountError(503,'계정 저장소에 연결할 수 없습니다. 잠시 후 다시 시도하세요.');}
  }
  private async db<T>(path:string,method='GET',body?:unknown,prefer?:string):Promise<T>{
    const response=await this.call('/rest/v1/'+path,method,this.secretKey,body,prefer);
    if(!response.ok)throw new AccountError(503,'계정 데이터 처리에 실패했습니다.');
    try{const text=await response.text();return (text?JSON.parse(text):undefined) as T;}
    catch{throw new AccountError(503,'계정 저장소 응답을 확인할 수 없습니다. 다시 시도하세요.');}
  }
  private async authResponse(response:Response):Promise<AuthResponse>{
    try{const data:unknown=await response.json();if(!data||typeof data!=='object'||Array.isArray(data))throw Error('invalid auth response');return data as AuthResponse;}
    catch{throw new AccountError(503,'인증 서버 응답을 확인할 수 없습니다. 다시 시도하세요.');}
  }
  private async dbRows<T>(path:string,method='GET',body?:unknown,prefer?:string):Promise<T[]>{
    const value=await this.db<unknown>(path,method,body,prefer);
    if(!Array.isArray(value)||value.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw new AccountError(503,'계정 저장소 목록 응답을 확인할 수 없습니다.');
    return value as T[];
  }
  private authenticate(mode:'signup',email:string,password:string):Promise<AccountLogin|AccountRegistrationPending>;
  private authenticate(mode:'token?grant_type=password',email:string,password:string):Promise<AccountLogin>;
  private async authenticate(mode:'signup'|'token?grant_type=password',email:string,password:string):Promise<AccountLogin|AccountRegistrationPending>{
    const credentials=normalizeCredentials({email,password});
    const identity=credentials.email,epoch=this.authEpoch.get(identity)??0;const unchanged=()=>!this.changing.has(identity)&&(this.authEpoch.get(identity)??0)===epoch;
    if(!unchanged())throw new AccountError(409,'비밀번호 변경 중입니다. 다시 로그인하세요.');
    const response=await this.call('/auth/v1/'+mode,'POST',this.publicKey,credentials);
    providerRateLimit(response);
    if(!response.ok){if(response.status>=500)throw new AccountError(503,'인증 서버에 연결할 수 없습니다.');throw new AccountError(401,mode==='signup'?'가입할 수 없습니다. 이메일을 확인하세요.':'로그인할 수 없습니다. 이메일 인증과 비밀번호를 확인하세요.');}
    const data=await this.authResponse(response);
    // GoTrue returns the bare user for an email-confirmation signup, and a
    // token plus nested user after authentication. Neither pending form
    // may create a game account or session.
    const pending=data.user??data;
    if(!data.access_token&&mode==='signup'&&typeof pending.id==='string'&&uuid.test(pending.id)&&typeof pending.email==='string'&&pending.email.toLowerCase()===identity)return {verificationRequired:true};
    if(typeof data.access_token!=='string'||!data.access_token||!data.user||typeof data.user.id!=='string'||!uuid.test(data.user.id)||typeof data.user.email!=='string'||data.user.email.toLowerCase()!==identity)throw new AccountError(503,'인증 서버 응답을 확인할 수 없습니다.');
    const {id,email:verifiedEmail}=data.user;
    // Ignore duplicates so concurrent first logins cannot reset existing progress or role.
    await this.db('duel_accounts?on_conflict=id','POST',{id,email:verifiedEmail,role:'player',profile:this.growth?syncOwned(newProfile(),this.growth):newProfile(),revision:0},'resolution=ignore-duplicates,return=minimal');
    const row=await this.get(id);
    if(!row)throw new AccountError(503,'계정 프로필을 불러올 수 없습니다.');
    const account=await this.refresh(row);
    const now=Date.now();if(now-this.lastSessionCleanup>=3600000){this.lastSessionCleanup=now;await this.db(`duel_sessions?expires_at=lt.${encodeURIComponent(new Date(now).toISOString())}`,'DELETE',undefined,'return=minimal').catch(()=>{this.lastSessionCleanup=0;});}
    const token=randomBytes(32).toString('hex');
    if(!unchanged())throw new AccountError(409,'비밀번호가 변경되었습니다. 다시 로그인하세요.');
    await this.db('duel_sessions','POST',{token_hash:hash(token),account_id:id,expires_at:new Date(Date.now()+expires).toISOString()},'return=minimal');
    if(!unchanged()){await this.logout(token);throw new AccountError(409,'비밀번호가 변경되었습니다. 다시 로그인하세요.');}
    return {token,account};
  }
  register(email:string,password:string){return this.authenticate('signup',email,password);}
  login(email:string,password:string){return this.authenticate('token?grant_type=password',email,password);}
  private async get(id:string){if(!uuid.test(id))return null;const rows=await this.dbRows<Row>(`duel_accounts?id=eq.${id}&select=*`);if(rows.length>1||rows.length===1&&rows[0].id!==id)throw new AccountError(503,'계정 저장소의 식별자를 확인할 수 없습니다.');if(rows.length) view(rows[0]);return rows[0]??null;}
  async sessionOwner(token:string){
    if(!/^[a-f0-9]{64}$/.test(token))return null;
    const sessions=await this.dbRows<SessionRow>(`duel_sessions?token_hash=eq.${hash(token)}&select=account_id,expires_at`);
    const session=sessions[0];if(!session)return null;
    if(sessions.length!==1||typeof session.account_id!=='string'||!uuid.test(session.account_id)||typeof session.expires_at!=='string'||!Number.isFinite(Date.parse(session.expires_at)))throw new AccountError(503,'계정 저장소의 세션 정보를 확인할 수 없습니다.');
    if(Date.parse(session.expires_at)<=Date.now())return null;
    return session.account_id;
  }
  async session(token:string){
    const generation=this.sessionGeneration,id=await this.sessionOwner(token);
    if(!id)return null;
    const row=await this.get(id),account=row?await this.refresh(row):null;
    if(generation!==this.sessionGeneration)throw new AccountError(503,'계정 인증 상태가 변경되었습니다. 다시 확인하세요.');
    return account;
  }
  async logout(token:string){if(/^[a-f0-9]{64}$/.test(token))try{await this.db(`duel_sessions?token_hash=eq.${hash(token)}`,'DELETE',undefined,'return=minimal');}finally{this.sessionGeneration++;}}
  async changePassword(id:string,email:string,currentPassword:string,newPassword:string,onSessionsRevoked?:(id:string)=>void){
    const identity=normalizeCredentials({email,password:currentPassword}).email;normalizeCredentials({email,password:newPassword});
    if(currentPassword===newPassword)throw new AccountError(400,'새 비밀번호는 기존 비밀번호와 달라야 합니다.');
    if(this.changing.has(identity))throw new AccountError(409,'비밀번호 변경 중입니다.');this.changing.add(identity);
    try{
      const response=await this.call('/auth/v1/token?grant_type=password','POST',this.publicKey,{email:identity,password:currentPassword});
      providerRateLimit(response);
      if(!response.ok)throw new AccountError(response.status>=500?503:401,'현재 비밀번호를 확인할 수 없습니다.');
      const auth=await this.authResponse(response);
      if(typeof auth.access_token!=='string'||!auth.access_token||auth.user?.id!==id||!uuid.test(id))throw new AccountError(401,'계정을 확인할 수 없습니다.');
      this.authEpoch.set(identity,(this.authEpoch.get(identity)??0)+1);
      // Revoke the game's prior sessions before changing the provider password.
      // If deletion is acknowledged or its outcome is uncertain, disconnect
      // cached sockets now. They must re-authenticate before acting again.
      try{await this.db(`duel_sessions?account_id=eq.${id}`,'DELETE',undefined,'return=minimal');}finally{this.sessionGeneration++;onSessionsRevoked?.(id);}
      const updated=await this.call('/auth/v1/user','PUT',this.publicKey,{password:newPassword,current_password:currentPassword},undefined,auth.access_token);
      providerRateLimit(updated);
      if(!updated.ok)throw new AccountError(updated.status>=500?503:400,'비밀번호 변경 요청에 실패했습니다. 다시 로그인해 확인하세요.');
    }finally{this.changing.delete(identity);}
  }
  async requestPasswordRecovery(email:string){
    if(!this.emailRecovery)throw new AccountError(403,'이메일 복구가 활성화되지 않았습니다.');
    const response=await this.call('/auth/v1/recover','POST',this.publicKey,{email:normalizeEmail(email)});
    providerRateLimit(response,'이메일 요청이 너무 많습니다. 잠시 기다려 주세요.');
    if(response.status>=500)throw new AccountError(503,'이메일 복구 서버에 연결할 수 없습니다.');
    // An identical response for absent and registered emails limits enumeration.
  }
  async completePasswordRecovery(email:string,code:string,newPassword:string,onSessionsRevoked?:(id:string)=>void){
    if(!this.emailRecovery)throw new AccountError(403,'이메일 복구가 활성화되지 않았습니다.');
    const {email:identity}=normalizeCredentials({email,password:newPassword});if(!/^\d{6,10}$/.test(code))throw new AccountError(400,'이메일 인증 코드를 확인하세요.');
    if(this.changing.has(identity))throw new AccountError(409,'비밀번호 변경 중입니다.');this.changing.add(identity);
    try{
      const response=await this.call('/auth/v1/verify','POST',this.publicKey,{email:identity,token:code,type:'recovery'});
      providerRateLimit(response);
      if(!response.ok)throw new AccountError(response.status>=500?503:401,'인증 코드가 유효하지 않거나 만료되었습니다.');
      const auth=await this.authResponse(response);
      if(typeof auth.access_token!=='string'||!auth.access_token||!auth.user||typeof auth.user.id!=='string'||!uuid.test(auth.user.id)||typeof auth.user.email!=='string'||auth.user.email.toLowerCase()!==identity)throw new AccountError(401,'인증 계정을 확인할 수 없습니다.');
      const id=auth.user.id;this.authEpoch.set(identity,(this.authEpoch.get(identity)??0)+1);
      try{await this.db(`duel_sessions?account_id=eq.${id}`,'DELETE',undefined,'return=minimal');}finally{this.sessionGeneration++;onSessionsRevoked?.(id);}
      const updated=await this.call('/auth/v1/user','PUT',this.publicKey,{password:newPassword},undefined,auth.access_token);
      providerRateLimit(updated);
      if(!updated.ok)throw new AccountError(updated.status>=500?503:400,'비밀번호 변경 실패. 새 이메일 코드를 받아 다시 시도하세요.');
      return id;
    }finally{this.changing.delete(identity);}
  }
  async updateDecks(id:string,revision:number,decks:AccountDeck[]){
    const row=await this.get(id);if(!row)throw new AccountError(404,'계정이 없습니다.');
    if(row.revision!==revision)throw new AccountError(409,'다른 기기에서 변경했습니다. 다시 불러와 주세요.');
    const profile=decodeAccountProfile({...this.view(row).profile,decks});
    const updated=await this.dbRows<Row>(`duel_accounts?id=eq.${id}&revision=eq.${revision}`,'PATCH',{profile,revision:revision+1},'return=representation');
    if(updated.length!==1)throw new AccountError(409,'다른 기기에서 변경했습니다. 다시 불러와 주세요.');if(updated[0].id!==id)throw new AccountError(503,'계정 저장소의 식별자를 확인할 수 없습니다.');return this.view(updated[0]);
  }
  async updateRewardPath(id:string,pathId:string,growth:GrowthView){
    for(let attempt=0;attempt<5;attempt++){
      const row=await this.get(id);
      if(!row)throw new AccountError(404,'계정이 없습니다.');
      const current=view(row),profile=selectRewardPath(current.profile,growth,pathId);
      if(JSON.stringify(current.profile)===JSON.stringify(profile))return current;
      const updated=await this.dbRows<Row>(`duel_accounts?id=eq.${id}&revision=eq.${row.revision}`,'PATCH',{profile,revision:row.revision+1},'return=representation');
      if(updated.length===1){if(updated[0].id!==id)throw new AccountError(503,'계정 저장소의 식별자를 확인할 수 없습니다.');return this.view(updated[0]);}
    }
    throw new AccountError(409,'다른 기기에서 변경했습니다. 다시 시도하세요.');
  }
  async recordMatch(id:string,match:MatchAward,growth:GrowthView){
    for(let attempt=0;attempt<5;attempt++){
      const row=await this.get(id);if(!row)throw new AccountError(404,'계정이 없습니다.');
      const current=this.view(row).profile;
      // On a lost acknowledgement the latest profile can already contain this
      // match. Send unchanged progress to the idempotent ledger RPC rather
      // than constructing a duplicate history entry. Older retries still use
      // the atomic ledger's match-id check even if their history was trimmed.
      const profile=decodeAccountProfile(current.recentMatches?.some(entry=>entry.matchId===match.matchId)?current:awardMatch(current,growth,match));
      const rows=await this.dbRows<Row>('rpc/duel_record_match','POST',{p_account:id,p_match:match.matchId,p_outcome:match.outcome,p_revision:row.revision,p_profile:profile});
      if(rows.length===1){if(rows[0].id!==id)throw new AccountError(503,'계정 저장소의 식별자를 확인할 수 없습니다.');return this.view(rows[0]);}
    }
    throw new AccountError(409,'경기 결과 저장이 지연되었습니다. 다시 시도하세요.');
  }
  async loadRoomSnapshots(){
    const snapshots:AccountRoomSnapshot[]=[],seen=new Set<string>();let cursor='';
    // Stable primary-key pagination also works when the provider enforces a
    // smaller maximum page size than requested. Do not stop at a short page.
    for(;;){
      const rows=await this.dbRows<{code:string;snapshot:AccountRoomSnapshot}>('duel_account_rooms?select=code,snapshot&order=code.asc&limit=100'+(cursor?'&code=gt.'+cursor:''));
      if(!Array.isArray(rows)||rows.length>100)throw new AccountError(503,'저장 경기 목록 응답을 확인할 수 없습니다.');
      if(!rows.length)return snapshots;
      for(const row of rows){
        if(!row||typeof row.code!=='string'||!/^[A-Z2-9]{6}$/.test(row.code)||seen.has(row.code)||!row.snapshot||row.snapshot.code!==row.code)throw new AccountError(503,'저장 경기 목록의 중복 또는 식별자 오류를 확인했습니다.');
        seen.add(row.code);snapshots.push(row.snapshot);
      }
      cursor=rows[rows.length-1].code;
    }
  }
  async initializeMaintenance(initial:boolean){
    await this.db('duel_runtime_settings?on_conflict=id','POST',{id:1,maintenance:initial},'resolution=ignore-duplicates,return=minimal');
    const rows=await this.dbRows<{maintenance:boolean}>('duel_runtime_settings?id=eq.1&select=maintenance');
    if(rows.length!==1||typeof rows[0].maintenance!=='boolean')throw new AccountError(503,'서버 점검 상태를 불러올 수 없습니다.');
    return rows[0].maintenance;
  }
  async setMaintenance(enabled:boolean){await this.db('duel_runtime_settings?on_conflict=id','POST',{id:1,maintenance:enabled},'resolution=merge-duplicates,return=minimal');}
  async saveRoomSnapshot(snapshot:AccountRoomSnapshot){await this.db('duel_account_rooms?on_conflict=code','POST',{code:snapshot.code,snapshot,updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=minimal');}
  async deleteRoomSnapshot(code:string){if(/^[A-Z2-9]{6}$/.test(code))await this.db(`duel_account_rooms?code=eq.${code}`,'DELETE',undefined,'return=minimal');}
}
