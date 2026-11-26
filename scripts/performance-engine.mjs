import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=resolve(process.argv[2]??'.');
const catalogDirectory=pathToFileURL(root+'/data/cards/');
const {file}=JSON.parse(readFileSync(new URL('active.json',catalogDirectory),'utf8'));
const raw=new URL(file,catalogDirectory);
const {createCatalog,practiceDeck}=await import(pathToFileURL(root+'/packages/engine/src/index.ts'));
const {LocalDuel}=await import(pathToFileURL(root+'/apps/client/src/local-duel.ts'));
const catalog=createCatalog(JSON.parse(readFileSync(raw,'utf8')));
const duel=new LocalDuel({
  catalog,deck:practiceDeck(catalog,'mage'),heroClass:'warrior',
  difficulty:3,seed:729,code:'PERF-CHECKPOINT',firstPlayer:0,catalogHash:'a'.repeat(64)
});
const iterations=1000;
function time(operation){
  operation();
  const runs=Array.from({length:7},()=>{
    const start=performance.now();
    for(let index=0;index<iterations;index++)operation();
    return (performance.now()-start)/iterations;
  });
  return [...runs].sort((a,b)=>a-b)[3];
}
console.log(JSON.stringify({
  iterations,phase:duel.view().state.phase,
  checkpointBytes:Buffer.byteLength(JSON.stringify(duel.checkpoint())),
  checkpointMedianMs:time(()=>duel.checkpoint()),
  viewMedianMs:time(()=>duel.view())
}));
