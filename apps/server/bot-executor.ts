import {Worker} from 'node:worker_threads';
import type {Action,BotDifficulty,BotWeights,Catalog,PlayerView} from '../../packages/engine/src/index.ts';

export type BotJob={view:PlayerView;difficulty:BotDifficulty;weights?:BotWeights};
export interface BotExecutor { run(job:BotJob,signal?:AbortSignal):Promise<Action[]>;close():Promise<void>;stats?():{active:number;queued:number;capacity:number} }
type Task={id:number;job:BotJob;resolve:(actions:Action[])=>void;reject:(error:Error)=>void;signal?:AbortSignal;onAbort?:()=>void;queuedTimer?:ReturnType<typeof setTimeout>};

/** A single bounded worker keeps high-level AI search off the HTTP/socket event
 * loop. The authoritative room applies and validates the selected action. */
export class WorkerBotExecutor implements BotExecutor {
  private worker?:Worker;private retiring?:Promise<void>;private queue:Task[]=[];private active?:Task;private timeout?:ReturnType<typeof setTimeout>;private id=0;private closed=false;
  private readonly catalog:Catalog;private readonly capacity:number;private readonly timeoutMs:number;private readonly queueWaitMs:number;
  constructor(catalog:Catalog,capacity=200,timeoutMs=6000,queueWaitMs=12000){if(![capacity,timeoutMs,queueWaitMs].every(n=>Number.isSafeInteger(n)&&n>0))throw new Error('Invalid AI worker limits');this.catalog=catalog;this.capacity=capacity;this.timeoutMs=timeoutMs;this.queueWaitMs=queueWaitMs;}
  stats(){return {active:this.active?1:0,queued:this.queue.length,capacity:this.capacity};}
  run(job:BotJob,signal?:AbortSignal):Promise<Action[]>{
    if(this.closed)return Promise.reject(new Error('AI worker closed'));
    if(signal?.aborted)return Promise.reject(new Error('AI job cancelled'));
    if(this.queue.length+(this.active?1:0)>=this.capacity)return Promise.reject(new Error('AI worker queue full'));
    return new Promise((resolve,reject)=>{const task:Task={id:++this.id,job,resolve,reject,signal};task.onAbort=()=>this.cancel(task,'AI job cancelled');signal?.addEventListener('abort',task.onAbort,{once:true});task.queuedTimer=setTimeout(()=>this.cancel(task,'AI worker queue timed out'),this.queueWaitMs);task.queuedTimer.unref();this.queue.push(task);this.pump();});
  }
  private clearQueued(task:Task){if(task.queuedTimer!==undefined){clearTimeout(task.queuedTimer);task.queuedTimer=undefined;}}
  private detach(task:Task){this.clearQueued(task);if(task.onAbort)task.signal?.removeEventListener('abort',task.onAbort);}
  private reject(task:Task,message:string){this.detach(task);task.reject(new Error(message));}
  private retire(worker:Worker){this.retiring=worker.terminate().then(()=>{},()=>{}).finally(()=>{this.retiring=undefined;this.pump();});}
  private cancel(task:Task,message:string){
    if(this.active===task){const worker=this.worker;this.worker=undefined;this.active=undefined;this.clearTimeout();this.reject(task,message);if(worker)this.retire(worker);else this.pump();return;}
    const index=this.queue.indexOf(task);if(index>=0){this.queue.splice(index,1);this.reject(task,message);}
  }
  private ensure(){
    if(this.worker)return this.worker;
    const worker=new Worker(new URL('./bot-worker.ts',import.meta.url),{workerData:{catalog:this.catalog}});this.worker=worker;
    worker.on('message',(reply:{id:number;actions?:Action[];error?:string})=>{
      if(this.worker!==worker||reply.id!==this.active?.id)return;
      const task=this.active;this.active=undefined;this.clearTimeout();
      this.detach(task);if(Array.isArray(reply.actions)&&reply.actions.length)task.resolve(reply.actions);else task.reject(new Error('AI worker returned no actions'));
      this.pump();
    });
    worker.on('error',()=>this.failed(worker,'AI worker failed'));
    worker.on('exit',()=>this.failed(worker,'AI worker exited'));
    return worker;
  }
  private clearTimeout(){if(this.timeout!==undefined){clearTimeout(this.timeout);this.timeout=undefined;}}
  private failed(worker:Worker,message:string){
    if(this.worker!==worker)return;
    this.worker=undefined;this.clearTimeout();const task=this.active;this.active=undefined;if(task)this.reject(task,message);this.retire(worker);
  }
  private pump(){
    if(this.closed||this.active||this.retiring||!this.queue.length)return;
    const task=this.queue.shift()!;this.clearQueued(task);this.active=task;
    try{const worker=this.ensure();this.timeout=setTimeout(()=>this.failed(worker,'AI worker timed out'),this.timeoutMs);this.timeout.unref();worker.postMessage({id:task.id,job:task.job});}
    catch{this.active=undefined;this.clearTimeout();this.reject(task,'AI worker unavailable');this.pump();}
  }
  async close(){
    if(this.closed)return;this.closed=true;this.clearTimeout();if(this.active)this.reject(this.active,'AI worker closed');this.active=undefined;for(const task of this.queue)this.reject(task,'AI worker closed');this.queue=[];
    const worker=this.worker;this.worker=undefined;if(worker)await worker.terminate();if(this.retiring)await this.retiring;
  }
}
