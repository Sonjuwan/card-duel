import {parentPort,workerData} from 'node:worker_threads';
import {rankBotActions} from '../../packages/engine/src/index.ts';
import type {Catalog} from '../../packages/engine/src/index.ts';
import {snapshotBattleCatalog} from '../../packages/engine/src/catalog-snapshot.ts';
import type {BotJob} from './bot-executor.ts';

const catalog=snapshotBattleCatalog(workerData.catalog as Catalog);
parentPort!.on('message',({id,job}:{id:number;job:BotJob})=>{
  try{parentPort!.postMessage({id,actions:rankBotActions(job.view,catalog,1,job.difficulty,{weights:job.weights,deadlineMs:1500})});}
  catch{parentPort!.postMessage({id,error:'AI calculation failed'});}
});
