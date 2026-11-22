import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {AI_ROOT,aiDirectory,listChampions,parseChampion,saveJsonAtomic} from '../server/ai-profile-store.ts';

/** The checkpoint is atomically replaced and contains its own matching
 * champion. Read it once, export that coherent pair, and never copy a lock.
 * This lets the player create a portable backup while training continues. */
export function backupAiData(destination:string,source=AI_ROOT){
  const output=resolve(destination),root=resolve(source);if(output===root||output.startsWith(root+'/')||output.startsWith(root+'\\'))throw Error('Backup must be outside the active AI directory.');
  if(existsSync(output))throw Error('Backup destination already exists; nothing overwritten.');
  const models=listChampions(root);if(!models.length)throw Error('No valid AI models to back up.');
  const destRoot=join(output,'data','ai');mkdirSync(output);mkdirSync(destRoot,{recursive:true});
  const result:{hash:string;games:number;minutes:number;promotions:number;mode:'checkpoint'|'champion'}[]=[];
  for(const current of models){
    const hash=current.catalogHash,from=aiDirectory(hash,root),to=aiDirectory(hash,destRoot);mkdirSync(to);
    let checkpoint:Record<string,unknown>|undefined,champion=current;
    try{const value=JSON.parse(readFileSync(join(from,'checkpoint.json'),'utf8')) as Record<string,unknown>,embedded=parseChampion(value.champion,hash);
      if(value.schema===1&&value.hash===hash&&embedded&&embedded.games>=current.games&&embedded.generation>=current.generation&&value.games===embedded.games&&value.round===embedded.generation&&Number.isSafeInteger(value.rng)&&typeof value.elapsedMs==='number'&&Number.isFinite(value.elapsedMs)&&value.elapsedMs>=0){checkpoint=value;champion=embedded;}
    }catch{/* A valid atomic champion is still useful if no checkpoint exists. */}
    saveJsonAtomic(join(to,'champion.json'),champion);if(checkpoint)saveJsonAtomic(join(to,'checkpoint.json'),checkpoint);
    writeFileSync(join(to,'status.txt'),`AI TRAINING — backed up (${checkpoint?'checkpoint':'champion'})\nSelf-play games: ${champion.games}\nElapsed minutes: ${champion.minutes.toFixed(2)}\nValidated promotions: ${champion.promotions}\nCaptured: ${champion.updatedAt}\n`);
    for(const entry of readdirSync(from,{withFileTypes:true}))if(entry.isFile()&&/^previous-champion-\d+(?:-[a-f0-9]{12})?\.json$/.test(entry.name))try{const old=parseChampion(JSON.parse(readFileSync(join(from,entry.name),'utf8')),hash);if(old&&old.promotions<=champion.promotions&&old.generation<=champion.generation)saveJsonAtomic(join(to,entry.name),old);}catch{/* Skip corrupt or concurrently replaced historical file. */}
    result.push({hash,games:champion.games,minutes:champion.minutes,promotions:champion.promotions,mode:checkpoint?'checkpoint':'champion'});
  }
  saveJsonAtomic(join(output,'backup.json'),{createdAt:new Date().toISOString(),models:result});return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const target=process.argv[2];if(!target)throw Error('Usage: node apps/cli/backup-ai-data.ts <new-backup-directory>');const result=backupAiData(target);console.log(JSON.stringify(result,null,2));console.log('Backup complete; training was not interrupted. Import from this folder with import-ai-data.cmd.');}catch(e){console.error(e instanceof Error?e.message:e);process.exitCode=1;}
}
