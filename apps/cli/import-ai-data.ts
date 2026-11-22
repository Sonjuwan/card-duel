import { existsSync, statSync, mkdirSync, mkdtempSync, copyFileSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_ROOT, aiDirectory, listChampions, parseChampion, readChampion } from '../server/ai-profile-store.ts';

export type ImportResult={hash:string;status:'imported'|'skipped';mode:'complete'|'champion';reason?:string};
const allowed=/^(champion\.json|checkpoint\.json|status\.txt|previous-champion-\d+(?:-[a-f0-9]{12})?\.json)$/;
/** Version isolation and an exclusive directory rename protect the destination.
 * A live source is never interrupted: copy only its atomic champion snapshot.
 * A full checkpoint import requires the source training process to be stopped. */
export function importAiData(source:string,destination=AI_ROOT):ImportResult[]{
  const given=resolve(source),nested=join(given,'data','ai');
  const sourceRoot=existsSync(nested)&&statSync(nested).isDirectory()?nested:given;
  if(!existsSync(sourceRoot)||!statSync(sourceRoot).isDirectory())throw Error('Previous AI data folder not found: '+sourceRoot);
  const output=resolve(destination);
  if(output===sourceRoot)throw Error('Source and destination are the same folder.');
  const models=listChampions(sourceRoot);
  if(!models.length)throw Error('No valid AI champions in '+sourceRoot);
  mkdirSync(output,{recursive:true});
  return models.map(model=>{
    const hash=model.catalogHash,to=aiDirectory(hash,output),from=aiDirectory(hash,sourceRoot);
    if(existsSync(to))return{hash,status:'skipped',mode:'complete',reason:'Destination already exists — nothing overwritten.'};
    const lock=join(from,'train.lock'),live=existsSync(lock);
    const staging=mkdtempSync(join(output,'.import-'));
    try{
      // Copying a single champion is atomic with the writer's rename, even if
      // training continues. A full checkpoint is read only when no lock exists.
      copyFileSync(join(from,'champion.json'),join(staging,'champion.json'));
      const captured=parseChampion(JSON.parse(readFileSync(join(staging,'champion.json'),'utf8')),hash);
      if(!captured)throw Error('Source champion changed or is invalid: '+hash);
      let mode:ImportResult['mode']='champion';
      if(!live&&existsSync(join(from,'checkpoint.json'))){
        for(const file of readdirSync(from,{withFileTypes:true}))if(file.isFile()&&allowed.test(file.name)&&file.name!=='champion.json')copyFileSync(join(from,file.name),join(staging,file.name));
        const checkpoint=JSON.parse(readFileSync(join(staging,'checkpoint.json'),'utf8'));
        // A running source might have started during the copy. Do not import
        // an inconsistent checkpoint/champion pair in that case.
        if(existsSync(lock)||checkpoint.schema!==1||checkpoint.hash!==hash||!parseChampion(checkpoint.champion,hash)||JSON.stringify(parseChampion(checkpoint.champion,hash))!==JSON.stringify(captured)){
          for(const file of readdirSync(staging))if(file!=='champion.json')rmSync(join(staging,file));
        }else mode='complete';
      }
      if(existsSync(to))return{hash,status:'skipped',mode,reason:'Destination appeared during import — nothing overwritten.'};
      renameSync(staging,to);
      if(!readChampion(hash,output))throw Error('Imported model failed verification: '+hash);
      return{hash,status:'imported',mode,...(mode==='champion'&&live?{reason:'Source training is running or locked; only its current champion was copied.'}:{})};
    }finally{if(existsSync(staging))rmSync(staging,{recursive:true,force:true});}
  });
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const input=process.argv[2];
  if(!input){console.error('Usage: node apps/cli/import-ai-data.ts "C:\\path\\to\\previous\\card-duel"');process.exitCode=1;}
  else try{
    const result=importAiData(input);
    for(const r of result)console.log(`${r.status.toUpperCase()} ${r.hash.slice(0,12)} | ${r.mode}${r.reason?' | '+r.reason:''}`);
    console.log('Previous files preserved. Start train-ai-10h.cmd to validate imported weights in the active catalog.');
  }catch(e){console.error(e instanceof Error?e.message:e);process.exitCode=1;}
}
