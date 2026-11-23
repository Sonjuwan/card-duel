import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

/** Do not silently overwrite a trained AI champion or change balance while
 * making UI/PWA-only release candidates. Deliberate card/AI releases must
 * update the reviewed baseline in a separate, explicitly approved change. */
export function verifyPlayableData(baseline,read){
  if(baseline.schemaVersion!==1||!baseline.files||typeof baseline.files!=='object')throw Error('Invalid playable data baseline');
  const paths=Object.keys(baseline.files).sort();
  if(paths.length!==5||!paths.includes('data/cards/active.json')||!paths.includes('data/cards/v0.23.0.json')||!paths.includes('data/progression/online.json')||paths.filter(x=>x.startsWith('data/ai-release/')).length!==2)throw Error('Unexpected guarded playable data files');
  const bytes={};
  for(const path of paths){
    if(!/^data\/(?:cards\/(?:active|v0\.23\.0)\.json|progression\/online\.json|ai-release\/[a-f0-9]{64}\/champion\.json)$/.test(path))throw Error('Unsafe playable data path: '+path);
    const content=read(path);const actual=createHash('sha256').update(content).digest('hex');
    if(actual!==baseline.files[path])throw Error('Playable game data drift (approval required): '+path);
    bytes[path]=content;
  }
  const active=JSON.parse(bytes['data/cards/active.json']);
  if(active?.file!==baseline.activeCardFile)throw Error('Active card revision changed');
  const cards=JSON.parse(bytes['data/cards/'+baseline.activeCardFile]);
  if(!Array.isArray(cards)||cards.length!==baseline.expectedActiveCards)throw Error('Card catalog contents changed');
  for(const path of paths.filter(x=>x.startsWith('data/ai-release/'))){
    const champion=JSON.parse(bytes[path]);
    if(champion?.catalogHash!==path.split('/')[2]||champion.schema!==1||!champion.weights||!Object.values(champion.weights).every(Number.isFinite))throw Error('Invalid AI champion '+path);
  }
  return{cards:cards.length,aiChampions:2,guardedFiles:paths.length};
}
function main(){
  const baseline=JSON.parse(readFileSync(resolve('data/integrity/playable-baseline.json'),'utf8'));
  const result=verifyPlayableData(baseline,path=>readFileSync(resolve(path)));
  console.log(`Approved playable data intact: ${result.cards} catalog entries, ${result.aiChampions} AI champions, ${result.guardedFiles} checksums`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{main();}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}}
