import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync, existsSync, closeSync, openSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AccountDeck, AccountProfile, AccountRole, AccountView, AccountRegistrationPending, GrowthView, MatchAward } from '../../packages/account-protocol.ts';
import {selectRewardPath} from '../../packages/reward-road.ts';
import {awardMatch,syncOwned} from '../../packages/progression.ts';
import type {AccountRoomSnapshot} from './rooms.ts';
import {decodeAccountProfile} from '../../packages/account-profile.ts';

const derive = promisify(scrypt);
const hashToken = (token:string) => createHash('sha256').update(token).digest('hex');
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export class AccountError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?:number;
  constructor(status:number,message:string,retryAfterSeconds?:number){super(message);this.status=status;this.retryAfterSeconds=retryAfterSeconds;}
}
type UserRow = {id:string;email:string;role:AccountRole;salt:string;password_hash:string;profile:string;revision:number};
export const newProfile=():AccountProfile=>({revision:0,decks:[],xp:0,rank:1,rankWins:0,questGames:0,ownedCards:[]});
function publicView(row:UserRow):AccountView {
  try{return {id:row.id,email:row.email,role:row.role,profile:decodeAccountProfile(JSON.parse(row.profile),{revision:row.revision,legacyRankWins:true})};}
  catch{throw new AccountError(503,'계정 저장소의 프로필 형식을 확인할 수 없습니다.');}
}
export function normalizeCredentials(input:unknown):{email:string;password:string} {
  if(!input||typeof input!=='object')throw new AccountError(400,'이메일과 비밀번호를 입력하세요.');
  const {email,password}=input as Record<string,unknown>;
  if(typeof email!=='string'||typeof password!=='string')throw new AccountError(400,'이메일과 비밀번호를 입력하세요.');
  const normalized=normalizeEmail(email);
  if(password.length<8||Buffer.byteLength(password)>128)throw new AccountError(400,'이메일과 8자 이상(최대 128바이트) 비밀번호를 확인하세요.');
  return {email:normalized,password};
}
export function normalizeEmail(email:unknown){if(typeof email!=='string')throw new AccountError(400,'이메일을 확인하세요.');const normalized=email.trim().toLowerCase();if(normalized.length>254||!/^([^\s@])+@[^\s@]+\.[^\s@]+$/.test(normalized))throw new AccountError(400,'이메일을 확인하세요.');return normalized;}
export interface AccountBackend {
  register(email:string,password:string):Promise<AccountLogin|AccountRegistrationPending>;
  login(email:string,password:string):Promise<{token:string;account:AccountView}>;
  session(token:string):Promise<AccountView|null>;
  sessionOwner(token:string):Promise<string|null>;
  logout(token:string):Promise<void>;
  changePassword(id:string,email:string,currentPassword:string,newPassword:string,onSessionsRevoked?:(id:string)=>void):Promise<void>;
  readonly emailRecovery?:boolean;
  requestPasswordRecovery?(email:string):Promise<void>;
  completePasswordRecovery?(email:string,code:string,newPassword:string,onSessionsRevoked?:(id:string)=>void):Promise<string>;
  updateDecks(id:string,revision:number,decks:AccountDeck[]):Promise<AccountView>;
  updateRewardPath?(id:string,pathId:string,growth:GrowthView):Promise<AccountView>;
  recordMatch(id:string,match:MatchAward,growth:GrowthView):Promise<AccountView>;
  loadRoomSnapshots():Promise<AccountRoomSnapshot[]>;
  saveRoomSnapshot(snapshot:AccountRoomSnapshot):Promise<void>;
  deleteRoomSnapshot(code:string):Promise<void>;
  initializeMaintenance(initial:boolean):Promise<boolean>;
  setMaintenance(enabled:boolean):Promise<void>;
}
export type AccountLogin={token:string;account:AccountView};
export class LocalAccountStore implements AccountBackend {
  private readonly db:DatabaseSync;
  private readonly growth?:GrowthView;
  constructor(path:string,growth?:GrowthView){
    this.growth=growth;
    if(path!==':memory:'){
      mkdirSync(dirname(path),{recursive:true,mode:0o700});
      if(!existsSync(path))closeSync(openSync(path,'ax',0o600));
      chmodSync(path,0o600);
    }
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN ('player','developer')),salt TEXT NOT NULL,password_hash TEXT NOT NULL,profile TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS ranked_matches(account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,match_id TEXT NOT NULL,outcome TEXT NOT NULL,recorded_at INTEGER NOT NULL,PRIMARY KEY(account_id,match_id));
      CREATE TABLE IF NOT EXISTS account_rooms(code TEXT PRIMARY KEY,snapshot TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runtime_settings(id INTEGER PRIMARY KEY CHECK(id=1),maintenance INTEGER NOT NULL CHECK(maintenance IN (0,1)));`);
  }
  async register(email:string,password:string){
    const credentials=normalizeCredentials({email,password});
    const salt=randomBytes(16).toString('hex'), passwordHash=(await derive(credentials.password,salt,64) as Buffer).toString('hex'),id=randomUUID();
    const existing=this.db.prepare('SELECT id FROM accounts WHERE email=?').get(credentials.email);
    if(existing)throw new AccountError(409,'이미 등록되었거나 사용할 수 없는 이메일입니다.');
    this.db.prepare('INSERT INTO accounts(id,email,role,salt,password_hash,profile) VALUES(?,?,?,?,?,?)').run(id,credentials.email,'player',salt,passwordHash,JSON.stringify(this.growth?syncOwned(newProfile(),this.growth):newProfile()));
    return this.issue(id);
  }
  async login(email:string,password:string){
    const credentials=normalizeCredentials({email,password});
    const row=this.db.prepare('SELECT * FROM accounts WHERE email=?').get(credentials.email) as UserRow|undefined;
    const computed=await derive(credentials.password,row?.salt??'00000000000000000000000000000000',64) as Buffer;
    const expected=Buffer.from(row?.password_hash??'0'.repeat(128),'hex');
    if(!timingSafeEqual(computed,expected)||!row)throw new AccountError(401,'이메일 또는 비밀번호가 일치하지 않습니다.');
    const latest=this.db.prepare('SELECT password_hash FROM accounts WHERE id=?').get(row.id) as {password_hash:string}|undefined;
    if(latest?.password_hash!==row.password_hash)throw new AccountError(401,'비밀번호가 변경되었습니다. 다시 로그인하세요.');
    return this.issue(row.id);
  }
  private issue(id:string){
    const account=this.get(id);
    const token=randomBytes(32).toString('hex');
    this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hashToken(token),id,Date.now()+SESSION_MS);
    return {token,account};
  }
  private get(id:string):AccountView {
    const row=this.db.prepare('SELECT * FROM accounts WHERE id=?').get(id) as UserRow|undefined;
    if(!row)throw new AccountError(404,'계정이 없습니다.');return this.view(row);
  }
  private view(row:UserRow):AccountView{
    const account=publicView(row);if(!this.growth)return account;
    const next=syncOwned(account.profile,this.growth);
    // Grants made by a content patch must survive a later rollback even when the
    // only action the player took was signing in or refreshing their profile.
    if(JSON.stringify(next)!==JSON.stringify(account.profile)){
      const changed=this.db.prepare('UPDATE accounts SET profile=?,revision=revision+1 WHERE id=? AND revision=?').run(JSON.stringify(next),row.id,row.revision);
      if(!changed.changes)return this.get(row.id);next.revision=row.revision+1;
    }
    account.profile=next;return account;
  }
  async session(token:string){
    if(!/^[a-f0-9]{64}$/.test(token))return null;
    const row=this.db.prepare('SELECT a.* FROM accounts a JOIN sessions s ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').get(hashToken(token),Date.now()) as UserRow|undefined;
    return row?this.view(row):null;
  }
  async sessionOwner(token:string){
    if(!/^[a-f0-9]{64}$/.test(token))return null;
    const row=this.db.prepare('SELECT account_id FROM sessions WHERE token_hash=? AND expires_at>?').get(hashToken(token),Date.now()) as {account_id:string}|undefined;
    return row?.account_id??null;
  }
  async logout(token:string){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));}
  async changePassword(id:string,email:string,currentPassword:string,newPassword:string,onSessionsRevoked?:(id:string)=>void){
    normalizeCredentials({email,password:currentPassword});normalizeCredentials({email,password:newPassword});if(currentPassword===newPassword)throw new AccountError(400,'새 비밀번호는 기존 비밀번호와 달라야 합니다.');
    const row=this.db.prepare('SELECT * FROM accounts WHERE id=? AND email=?').get(id,email) as UserRow|undefined;
    if(!row)throw new AccountError(401,'계정을 확인할 수 없습니다.');
    const old=await derive(currentPassword,row.salt,64) as Buffer;
    if(!timingSafeEqual(old,Buffer.from(row.password_hash,'hex')))throw new AccountError(401,'현재 비밀번호가 일치하지 않습니다.');
    const salt=randomBytes(16).toString('hex'),hash=(await derive(newPassword,salt,64) as Buffer).toString('hex');
    this.db.exec('BEGIN IMMEDIATE');try{
      const updated=this.db.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=? AND password_hash=?').run(salt,hash,id,row.password_hash);
      if(!updated.changes)throw new AccountError(409,'비밀번호가 변경되었습니다. 다시 로그인하세요.');
      this.db.prepare('DELETE FROM sessions WHERE account_id=?').run(id);this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
    onSessionsRevoked?.(id);
  }
  async updateDecks(id:string,revision:number,decks:AccountDeck[]){
    const current=this.get(id);
    if(current.profile.revision!==revision)throw new AccountError(409,'다른 기기에서 변경했습니다. 다시 불러와 주세요.');
    const next=decodeAccountProfile({...current.profile,decks});
    const result=this.db.prepare('UPDATE accounts SET profile=?,revision=revision+1 WHERE id=? AND revision=?').run(JSON.stringify(next),id,revision);
    if(!result.changes)throw new AccountError(409,'다른 기기에서 변경했습니다. 다시 불러와 주세요.');
    return this.get(id);
  }
  async updateRewardPath(id:string,pathId:string,growth:GrowthView){
    const current=this.get(id),next=selectRewardPath(current.profile,growth,pathId),revision=current.profile.revision;
    if(JSON.stringify(current.profile)===JSON.stringify(next))return current;
    const changed=this.db.prepare('UPDATE accounts SET profile=?,revision=revision+1 WHERE id=? AND revision=?').run(JSON.stringify(next),id,revision);
    if(changed.changes!==1)throw new AccountError(409,'다른 기기에서 변경했습니다. 다시 시도하세요.');
    return {...current,profile:{...next,revision:revision+1}};
  }
  async recordMatch(id:string,match:MatchAward,growth:GrowthView){
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const current=this.get(id);
      const inserted=this.db.prepare('INSERT OR IGNORE INTO ranked_matches(account_id,match_id,outcome,recorded_at) VALUES(?,?,?,?)').run(id,match.matchId,match.outcome,Date.now());
      if(inserted.changes){const next=decodeAccountProfile(awardMatch(current.profile,growth,match));this.db.prepare('UPDATE accounts SET profile=?,revision=revision+1 WHERE id=?').run(JSON.stringify(next),id);}
      this.db.exec('COMMIT');return this.get(id);
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  async loadRoomSnapshots(){return (this.db.prepare('SELECT snapshot FROM account_rooms').all() as {snapshot:string}[]).map(row=>JSON.parse(row.snapshot) as AccountRoomSnapshot);}
  async saveRoomSnapshot(snapshot:AccountRoomSnapshot){this.db.prepare('INSERT INTO account_rooms(code,snapshot) VALUES(?,?) ON CONFLICT(code) DO UPDATE SET snapshot=excluded.snapshot').run(snapshot.code,JSON.stringify(snapshot));}
  async deleteRoomSnapshot(code:string){this.db.prepare('DELETE FROM account_rooms WHERE code=?').run(code);}
  async initializeMaintenance(initial:boolean){
    this.db.prepare('INSERT OR IGNORE INTO runtime_settings(id,maintenance) VALUES(1,?)').run(initial?1:0);
    return (this.db.prepare('SELECT maintenance FROM runtime_settings WHERE id=1').get() as {maintenance:number}).maintenance===1;
  }
  async setMaintenance(enabled:boolean){this.db.prepare('INSERT INTO runtime_settings(id,maintenance) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET maintenance=excluded.maintenance').run(enabled?1:0);}
  /** Explicit server-side operator action, never exposed by registration or a player API. */
  setRole(email:string,role:AccountRole){
    if(role!=='developer'&&role!=='player')throw new Error('Invalid account role');
    const result=this.db.prepare('UPDATE accounts SET role=? WHERE email=?').run(role,email.trim().toLowerCase());
    if(!result.changes)throw new AccountError(404,'계정이 없습니다.');
  }
  close(){this.db.close();}
}
