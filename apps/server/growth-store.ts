import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Catalog} from '../../packages/engine/src/index.ts';
import {RuleError} from '../../packages/engine/src/index.ts';
import {buildGrowth,verifyRankedDecks} from '../../packages/progression.ts';
import {auditRankedDecks} from '../../packages/progression-audit.ts';
import type {RankTuning,UnlockXp} from '../../packages/progression.ts';

export type GrowthConfig={schemaVersion:1;cardPowerOverrides:Record<string,number>;rankTuning:Record<string,RankTuning>;unlockXp?:UnlockXp};
const defaultPath=new URL('../../data/progression/online.json',import.meta.url);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function parse(raw:unknown,catalog:Catalog){
  if(!object(raw)||raw.schemaVersion!==1||!object(raw.cardPowerOverrides)||!object(raw.rankTuning)||Object.keys(raw).some(k=>!['schemaVersion','cardPowerOverrides','rankTuning','unlockXp'].includes(k)))throw new RuleError('잘못된 성장 설정입니다.');
  if(raw.unlockXp!==undefined&&(!object(raw.unlockXp)||Object.keys(raw.unlockXp).length!==2||!Object.hasOwn(raw.unlockXp,'base')||!Object.hasOwn(raw.unlockXp,'perPower')))throw new RuleError('카드 획득 XP 비용 설정이 유효하지 않습니다.');
  for(const tuning of Object.values(raw.rankTuning))if(!object(tuning)||Object.keys(tuning).length!==2||!Object.hasOwn(tuning,'deckPower')||!Object.hasOwn(tuning,'intelligence'))throw new RuleError('랭크 설정은 덱 전력과 AI 지능만 허용합니다.');
  const config=raw as GrowthConfig;
  try{return {config,growth:buildGrowth(catalog,config.cardPowerOverrides,config.rankTuning,config.unlockXp)};}catch(e){throw new RuleError(e instanceof Error?e.message:'성장 설정이 유효하지 않습니다.');}
}
export function loadGrowth(catalog:Catalog,path:URL|string=defaultPath){return parse(JSON.parse(readFileSync(path,'utf8')),catalog).growth;}
const hash=(raw:string)=>createHash('sha256').update(raw).digest('hex');
const HISTORY_FILE=/^online-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{8}\.json$/;
/** Local developer-only configuration; never changes the card catalog. */
export class GrowthConfigStore{
  readonly path:string;
  constructor(path:string=fileURLToPath(defaultPath)){this.path=path;}
  read(catalog:Catalog){const raw=readFileSync(this.path,'utf8');return {baseHash:hash(raw),...parse(JSON.parse(raw),catalog)};}
  check(base:unknown,raw:unknown,catalog:Catalog){const current=this.read(catalog);if(base!==current.baseHash)throw new RuleError('다른 편집에서 성장 설정이 변경되었습니다. 새로고침하세요.');const draft=parse(raw,catalog),deckAudit=auditRankedDecks(catalog,draft.growth);return {...draft,deckAudit};}
  /** Block card patches that would leave an unusable active growth configuration. */
  checkCatalog(catalog:Catalog){try{return verifyRankedDecks(catalog,this.read(catalog).growth);}catch(e){throw new RuleError(`카드 패치와 성장 설정이 호환되지 않습니다. /growth에서 관련 카드 전력 설정을 먼저 수정하세요. (${e instanceof Error?e.message:'검사 실패'})`);}}
  listHistory(){const folder=join(dirname(this.path),'history');if(!existsSync(folder))return [];return readdirSync(folder,{withFileTypes:true}).filter(entry=>entry.isFile()&&HISTORY_FILE.test(entry.name)).map(entry=>entry.name).sort().reverse();}
  previewHistory(base:unknown,name:unknown,catalog:Catalog){if(typeof name!=='string'||!HISTORY_FILE.test(name)||!this.listHistory().includes(name))throw new RuleError('유효한 성장 설정 백업을 선택하세요.');const previous=JSON.parse(readFileSync(join(dirname(this.path),'history',name),'utf8'));return this.check(base,previous,catalog);}
  save(base:unknown,raw:unknown,catalog:Catalog){
    const draft=this.check(base,raw,catalog),previous=readFileSync(this.path,'utf8');
    const folder=join(dirname(this.path),'history');mkdirSync(folder,{recursive:true});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-'),id=randomUUID().slice(0,8),backup=`online-${stamp}-${id}.json`;
    writeFileSync(join(folder,backup),previous,{flag:'wx'});
    const next=JSON.stringify(draft.config,null,2)+'\n',tmp=join(dirname(this.path),`.online-${id}.tmp`);
    writeFileSync(tmp,next,{flag:'wx'});renameSync(tmp,this.path);return {baseHash:hash(next),...draft,backup};
  }
}
