import {Worker} from 'node:worker_threads';
import {randomUUID} from 'node:crypto';
import {RuleError} from '../../packages/engine/src/index.ts';
import type {Catalog} from '../../packages/engine/src/index.ts';
import type {BalanceConfig,BalanceResult} from './balance-analysis.ts';
export interface LabStatus {id:string;state:'running'|'complete'|'cancelled'|'error';version:string;config:BalanceConfig;changedIds:string[];result:BalanceResult|null;error?:string}
/** At most one bounded background lab. Results belong to the frozen draft
 * snapshot at launch even if the user continues editing or saves later. */
export class BalanceLab{
  private worker:Worker|null=null;
  private status:LabStatus|null=null;
  get(){return this.status;}
  start(version:string,base:Catalog,draft:Catalog,config:BalanceConfig){
    if(this.worker)throw new RuleError('이미 밸런스 시험이 실행 중입니다. 먼저 끝내거나 중단하세요.');
    const id=randomUUID(),worker=new Worker(new URL('./balance-worker.ts',import.meta.url),{workerData:{base,draft,config}});
    this.worker=worker;this.status={id,state:'running',version,config,changedIds:[...new Set([...Object.keys(base),...Object.keys(draft)])].filter(key=>JSON.stringify(base[key])!==JSON.stringify(draft[key])),result:null};
    const update=(state:LabStatus['state'],error?:string)=>{if(this.worker!==worker||this.status?.id!==id)return;this.status={...this.status,state,...(error?{error}:{})};if(state!=='running')this.worker=null;};
    worker.on('message',(message:{kind:'progress'|'complete';result:BalanceResult})=>{if(this.worker!==worker||this.status?.id!==id)return;this.status={...this.status,result:message.result};if(message.kind==='complete')update('complete');});
    worker.on('error',e=>update('error',e.message));
    worker.on('exit',code=>{if(this.worker===worker)update('error',`시험 작업이 예상치 않게 종료되었습니다 (${code}).`);});
    return this.status;
  }
  cancel(id:unknown){if(!this.status||this.status.id!==id)throw new RuleError('현재 시험 ID가 아닙니다.');if(this.worker){const worker=this.worker;this.worker=null;this.status={...this.status,state:'cancelled'};void worker.terminate();}return this.status;}
  close(){if(this.worker&&this.status)this.cancel(this.status.id);}
}
