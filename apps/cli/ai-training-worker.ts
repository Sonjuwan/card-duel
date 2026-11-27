import { parentPort,workerData } from 'node:worker_threads';
import { snapshotBattleCatalog } from '../../packages/engine/src/catalog-snapshot.ts';
import { CardStore } from '../server/card-store.ts';
import { aiCatalogHash } from '../server/ai-profile-store.ts';
import { playTrainingMatch } from './ai-training-match.ts';
import type { TrainingJob } from './ai-training-match.ts';
const {catalog}=new CardStore().read(workerData.version);
if(aiCatalogHash(catalog)!==workerData.hash)throw Error('Card data has changed');
const snapshot=snapshotBattleCatalog(catalog);
parentPort!.on('message',({id,job}:{id:number;job:TrainingJob})=>{
  try{parentPort!.postMessage({id,result:playTrainingMatch(job.researchRows?snapshot:catalog,job)});}
  catch(e){parentPort!.postMessage({id,error:e instanceof Error?e.stack:String(e)});}
});
