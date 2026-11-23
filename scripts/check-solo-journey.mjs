import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const expected=2;
/** A bounded real-engine solo progression smoke check, not a browser test or AI rating. */
export function validateSoloJourney(output,expectedGames=expected){
  const rows=String(output).trim().split(/\r?\n/).filter(Boolean).map((line,index)=>{
    try{return JSON.parse(line);}catch{throw Error(`Invalid solo smoke JSON at line ${index+1}`);}
  });
  assert.ok(rows.length>=2,'solo smoke emitted too few records');
  const header=rows[0],summary=rows.at(-1);
  assert.equal(header.count,expectedGames,'wrong number of requested games');
  assert.equal(summary.complete,true,'solo smoke is incomplete');
  assert.equal(summary.games,expectedGames,'not all games finished');
  assert.ok(summary.moves>=expectedGames,'no battle actions were verified');
  assert.ok(summary.restores>=expectedGames,'mid-battle checkpoint restoration not verified');
  assert.ok(summary.backupChecks>=1,'progression backup restoration not verified');
  assert.ok(Number.isFinite(summary.rank)&&summary.rank>=1,'rank progression missing');
  assert.ok(summary.stats?.wins+summary.stats?.losses+summary.stats?.draws===expectedGames,'eligible duel results not settled');
  return{games:summary.games,moves:summary.moves,restores:summary.restores,backupChecks:summary.backupChecks};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=spawnSync(process.execPath,['apps/cli/benchmark-solo-journey.ts',String(expected),'20261123'],{
    cwd:root,encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024,env:{...process.env,NODE_OPTIONS:process.env.NODE_OPTIONS??''}
  });
  if(result.error||result.status!==0){console.error(result.stderr||result.error||`Solo smoke exited ${result.status}`);process.exitCode=1;}
  else try{console.log(JSON.stringify({soloSmoke:'passed',...validateSoloJourney(result.stdout)}));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
