import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const SOLO_PORT=4179;
const packageDirectory=fileURLToPath(new URL('../../dist/solo-app/',import.meta.url));
// Prior published previews bundled these assets and still need integrity verification.
const legacyMusicAssets=['home','prepare','library','deck','battle-1','battle-2','battle-3','battle-4','battle-5','battle-6','progress','win','loss']
  .map(name=>`music-${name}.mp3`);
const types={...Object.fromEntries(legacyMusicAssets.map(name=>[name,'audio/mpeg'])),'index.html':'text/html; charset=utf-8','game.js':'text/javascript; charset=utf-8','game.css':'text/css; charset=utf-8','manifest.webmanifest':'application/manifest+json','register.js':'text/javascript; charset=utf-8','sw.js':'text/javascript; charset=utf-8','version.json':'application/json; charset=utf-8','icon-192.png':'image/png','icon-512.png':'image/png'};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function loadSoloRelease(directory=packageDirectory){
  const worker=readFileSync(resolve(directory,'sw.js')).toString('utf8');
  const marker=/^const release = (.+);$/m,match=worker.match(marker);
  if(!match)throw Error('Missing release information in sw.js');
  const release=JSON.parse(match[1]),expected=release?.files&&typeof release.files==='object'?Object.keys(release.files):[];
  // Legacy releases have one inline document (5 assets); new releases keep
  // the same independent HTML separately and install 7 verified resources.
  const required=['index.html','manifest.webmanifest','register.js','icon-192.png','icon-512.png'];
  const hasSplitGame=expected.includes('game.js')&&expected.includes('game.css');
  const hasLegacyMusic=legacyMusicAssets.every(name=>expected.includes(name));
  const validLayout=expected.length===5 ||
    (hasSplitGame&&(expected.length===7 ||
      (hasLegacyMusic&&expected.length===7+legacyMusicAssets.length)));
  if(!validLayout||!required.every(name=>expected.includes(name))||
    !expected.every(name=>Object.hasOwn(types,name)&&name!=='sw.js'))throw Error('Invalid release asset list');
  const files=new Map([['sw.js',Buffer.from(worker)],...expected.map(name=>[name,readFileSync(resolve(directory,name))])]);
  for(const name of expected)if(!Object.hasOwn(release.files,name)||sha256(files.get(name))!==release.files[name])throw Error(`Release asset integrity mismatch: ${name}`);
  const template=worker.replace(marker,'const release = __CACHE_SPEC__;');
  if(sha256(JSON.stringify(release.files)+template)!==release.id)throw Error('Release worker integrity mismatch: sw.js');
  let metadata;
  try{metadata=readFileSync(resolve(directory,'version.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!metadata&&release.version!==undefined)throw Error('Missing published release metadata');
  if(metadata){
    const published=JSON.parse(metadata);
    if(published.release!==release.id||published.version!==release.version||!/^\d+\.\d+\.\d+$/.test(published.version)||
      !files.get('index.html').includes(`name="card-duel-build" content="${published.version}"`))throw Error('Invalid published release metadata');
    files.set('version.json',metadata);
  }
  return {id:release.id,files};
}
export function createSoloAppServer(directory=packageDirectory){
  // Snapshot one verified release for the lifetime of this process. A partial
  // extract over the running directory cannot change the files it serves.
  const {files}=loadSoloRelease(directory);
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-cache');
    const address=server.address();
    if(typeof address!=='object'||!address||req.headers.host!==`127.0.0.1:${address.port}`){res.writeHead(403).end('Local app only');return;}
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    const name=pathname==='/'?'index.html':pathname.slice(1);
    if(!name||!Object.hasOwn(types,name)||!files.has(name)){res.writeHead(404).end('Not found');return;}
    const body=files.get(name);
    res.writeHead(200,{'Content-Type':types[name],'Content-Length':body.length});
    res.end(req.method==='HEAD'?undefined:body);
  });
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    if(process.argv[2]==='--verify')console.log(`Verified complete RUNEHALL release: ${loadSoloRelease(process.argv[3]?resolve(process.argv[3]):packageDirectory).id}`);
    else{
      const server=createSoloAppServer();
      server.on('error',error=>{console.error(`Cannot start RUNEHALL at 127.0.0.1:${SOLO_PORT}: ${error.message}`);process.exitCode=1;});
      server.listen(SOLO_PORT,'127.0.0.1',()=>console.log(`RUNEHALL · ${'http://127.0.0.1:'+SOLO_PORT+'/'}\nOpen this exact address in your usual browser. Keep this window running for first setup and updates. Restart the launcher after replacing a release.`));
    }
  }catch(error){console.error(`App package invalid: ${error.message}. Extract the complete release into a new folder or rebuild it.`);process.exitCode=1;}
}
