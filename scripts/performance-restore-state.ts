import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CardStore} from '../apps/server/card-store.ts';
import {LocalDuel} from '../apps/client/src/local-duel.ts';
import {createOfflineRankedInput,offlineGrowth,readOfflineGrowth} from '../apps/client/src/offline-growth.ts';
import {HERO_CLASSES,practiceDeck} from '../packages/engine/src/index.ts';
import {recommendedOwnedDeck} from '../packages/progression.ts';
import type {LocalDuelCheckpoint} from '../apps/client/src/local-duel.ts';
const {catalog}=new CardStore().read();
const hash='a'.repeat(64),now=1770000000000;
const growth=offlineGrowth(catalog),profile=readOfflineGrowth(undefined,growth);
const fixtures:LocalDuelCheckpoint[]=[];
for(const [i,heroClass] of HERO_CLASSES.entries()){
  const input={catalog,deck:practiceDeck(catalog,heroClass),heroClass,difficulty:25 as const,seed:51+i,deckSeed:93+i,code:'restore-'+i,catalogHash:hash,animationSpeed:'instant' as const};
  const duel=new LocalDuel(i%2===0?input:createOfflineRankedInput({...input,deck:recommendedOwnedDeck(catalog,growth,heroClass,profile.profile,i+1)},profile,growth));
  const snapshot=duel.checkpoint(now)!;
  // Opaque instance IDs deliberately differ between processes; normalize
  // fixture IDs before comparing exact checkpoint digests.
  let id=0;for(const player of snapshot.state.players)for(const c of [...player.deck,...player.hand,...player.board,...player.secrets])c.instanceId='fixture-'+(++id);
  fixtures.push(snapshot);
  const done=LocalDuel.restore(snapshot,catalog,hash,undefined,now);
  done.forfeit();fixtures.push(done.checkpoint(now)!);
}
const digest=createHash('sha256');
const times:number[]=[];
const iterations=180;
for(let i=0;i<iterations;i++){
  const saved=fixtures[i%fixtures.length];
  const start=performance.now();
  const duel=LocalDuel.restore(saved,catalog,hash,undefined,now);
  times.push(performance.now()-start);
  const checkpoint=duel.checkpoint(now)!;
  assert.deepEqual(checkpoint,saved);
  digest.update(JSON.stringify(checkpoint)+'\n');
}
times.sort((a,b)=>a-b);
console.log(JSON.stringify({iterations,fixtures:fixtures.length,medianMs:times[Math.ceil(times.length*.5)-1],p95Ms:times[Math.ceil(times.length*.95)-1],checkpointSha256:digest.digest('hex')}));
