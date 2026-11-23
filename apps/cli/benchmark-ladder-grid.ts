import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {CardStore} from '../server/card-store.ts';
import {aiCatalogHash,readChampion,aiWeightFingerprint} from '../server/ai-profile-store.ts';
import {DEFAULT_BOT_WEIGHTS} from '../../packages/engine/src/index.ts';

/** Resumable experiment only: each complete adjacent comparison is stored
 * separately. A failed group does not destroy earlier results or stop later
 * groups. The input identity must match before an existing result is reused. */
const pairs=Number(process.argv[2]??9),seedOffset=Number(process.argv[3]??3500),mode=process.argv[4]??'decision',directory=resolve(process.argv[5]??`docs/audits/ladder-${mode}-${seedOffset}-${pairs}`),start=Number(process.argv[6]??1),end=Number(process.argv[7]??24);
if(!Number.isSafeInteger(pairs)||pairs<1||pairs>100||!Number.isSafeInteger(seedOffset)||seedOffset<0||!['turn','decision'].includes(mode)||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end>24||start>end)throw Error('Usage: benchmark:ladder-grid -- <pairs 1-100> <seed offset> <turn|decision> [output directory] [start lower rank] [end lower rank]');
const {version,catalog}=new CardStore().read(),hash=aiCatalogHash(catalog),weights=aiWeightFingerprint(readChampion(hash)?.weights??DEFAULT_BOT_WEIGHTS);
const identity={version,hash,weights,pairs,seedOffset,mode};
mkdirSync(directory,{recursive:true});
const checked=(raw:any,level:number)=>{
  const h=raw?.header,r=raw?.result;
  if(!h||!r||h.version!==version||h.hash!==hash||h.weights!==weights||h.pairs!==pairs||h.seedOffset!==seedOffset||h.target!==level+1||!String(h.experiment).startsWith(`${mode}-stable `)||r.target!==level+1||r.level!==level||r.pairs!==pairs||r.valid!==true||r.capped!==0||![r.wins,r.losses,r.draws].every(n=>Number.isSafeInteger(n)&&n>=0)||r.wins+r.losses+r.draws!==pairs*2)throw Error('Incomplete or incompatible adjacent result');
  if(!Array.isArray(r.pairScores)||r.pairScores.length!==pairs||!r.pairScores.every((p:unknown)=>Array.isArray(p)&&p.length===2&&p.every(n=>[0,.5,1].includes(n))))throw Error('Missing paired game outcomes');
  const scores=r.pairScores.flat();if(scores.filter((n:number)=>n===1).length!==r.wins||scores.filter((n:number)=>n===0).length!==r.losses||scores.filter((n:number)=>n===.5).length!==r.draws)throw Error('Paired results do not match aggregate counts');
  return raw as {header:Record<string,unknown>;result:{wins:number;losses:number;draws:number;target:number;level:number}};
};
const completed:ReturnType<typeof checked>[]=[],failed:number[]=[];
for(let level=start;level<=end;level++){
  const path=resolve(directory,`rank-${String(level).padStart(2,'0')}-${String(level+1).padStart(2,'0')}.json`);
  try{
    if(existsSync(path)){completed.push(checked(JSON.parse(readFileSync(path,'utf8')),level));console.log(`Reused ${level+1}/${level}`);continue;}
    const child=spawnSync(process.execPath,['apps/cli/benchmark-ladder.ts',String(pairs),String(level),String(seedOffset),String(level+1),mode],{encoding:'utf8',timeout:30*60_000,maxBuffer:4*1024*1024});
    if(child.status!==0)throw Error(child.error?.message??child.stderr??'Benchmark child failed');
    const [header,result,...extra]=child.stdout.trim().split('\n').map(line=>JSON.parse(line));
    if(extra.length)throw Error('Unexpected benchmark output');
    const row=checked({header,result},level);
    writeFileSync(path,JSON.stringify(row,null,2)+'\n',{flag:'wx'});completed.push(row);console.log(`Completed ${level+1}/${level}: ${result.wins}/${result.losses}/${result.draws}`);
  }catch(e){failed.push(level);console.error(`Unavailable ${level+1}/${level}: ${e instanceof Error?e.message:String(e)}`);}
}
const aggregate=completed.reduce((s,{result:r})=>({wins:s.wins+r.wins,losses:s.losses+r.losses,draws:s.draws+r.draws,higher:s.higher+(r.wins>r.losses?1:0),equal:s.equal+(r.wins===r.losses?1:0),lower:s.lower+(r.wins<r.losses?1:0)}),{wins:0,losses:0,draws:0,higher:0,equal:0,lower:0});
console.log(JSON.stringify({identity,range:[start,end],completed:completed.length,failed,aggregate,complete:completed.length===24}));
if(failed.length)process.exitCode=1;
