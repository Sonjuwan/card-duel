import { parentPort,workerData } from 'node:worker_threads';
import { snapshotBattleCatalog } from '../../packages/engine/src/catalog-snapshot.ts';
import { CardStore } from '../server/card-store.ts';
import { aiCatalogHash } from '../server/ai-profile-store.ts';
import { playTrainingMatch } from './ai-training-match.ts';
import type { TrainingJob } from './ai-training-match.ts';
const {catalog}=new CardStore().read(workerData.version);
if(aiCatalogHash(catalog)!==workerData.hash)throw Error('Card data has changed');
const snapshot=snapshotBattleCatalog(catalog);
parentPort!.on('message', (message: {id:number;job:TrainingJob} | {id:number;jobs:TrainingJob[]}) => {
  const { id } = message;
  try {
    if ('jobs' in message) {
      // Each seat's control and treatment share a fixture. The cache ends with
      // that pair and keys exact position, policy, budget and resolved weights.
      const reuseDecisions: NonNullable<Parameters<typeof playTrainingMatch>[2]>['reuseDecisions'] = new Map();
      const results = message.jobs.map(job => playTrainingMatch(snapshot, job, { reuseDecisions }));
      parentPort!.postMessage({ id, results });
    } else {
      const { job } = message;
      parentPort!.postMessage({ id, result: playTrainingMatch(job.researchRows ? snapshot : catalog, job) });
    }
  } catch (error) {
    parentPort!.postMessage({ id, error: error instanceof Error ? error.stack : String(error) });
  }
});
