import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const SOLO_PORT=4179;
const packageDirectory=fileURLToPath(new URL('../../dist/solo-app/',import.meta.url));
const types={'index.html':'text/html; charset=utf-8','game.js':'text/javascript; charset=utf-8','game.css':'text/css; charset=utf-8','manifest.webmanifest':'application/manifest+json','register.js':'text/javascript; charset=utf-8','sw.js':'text/javascript; charset=utf-8','icon-192.png':'image/png','icon-512.png':'image/png'};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function loadSoloRelease(directory=packageDirectory){
  const worker=readFileSync(resolve(directory,'sw.js')).toString('utf8');
  const marker=/^const release = (.+);$/m,match=worker.match(marker);
  if(!match)throw Error('Missing release information in sw.js');
  const release=JSON.parse(match[1]),expected=release?.files&&typeof release.files==='object'?Object.keys(release.files):[];
  // Legacy releases have one inline document (5 assets); new releases keep
  // the same independent HTML separately and install 7 verified resources.
  const required=['index.html','manifest.webmanifest','register.js','icon-192.png','icon-512.png'];
  if(!required.every(name=>expected.includes(name))||![5,7].includes(expected.length)||!expected.every(name=>Object.hasOwn(types,name)&&name!=='sw.js')||(expected.includes('game.js')!==expected.includes('game.css')))throw Error('Invalid release asset list');
  const files=new Map([['sw.js',Buffer.from(worker)],...expected.map(name=>[name,readFileSync(resolve(directory,name))])]);
  for(const name of expected)if(!Object.hasOwn(release.files,name)||sha256(files.get(name))!==release.files[name])throw Error(`Release asset integrity mismatch: ${name}`);
  const template=worker.replace(marker,'const release = __CACHE_SPEC__;');
  if(sha256(JSON.stringify(release.files)+template)!==release.id)throw Error('Release worker integrity mismatch: sw.js');
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
    const name=req.url==='/'?'index.html':req.url?.slice(1);
    if(!name||!Object.hasOwn(types,name)||!files.has(name)){res.writeHead(404).end('Not found');return;}
    const body=files.get(name);
    res.writeHead(200,{'Content-Type':types[name],'Content-Length':body.length});
    res.end(req.method==='HEAD'?undefined:body);
  });
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    if(process.argv[2]==='--verify')console.log(`Verified complete Card Duel release: ${loadSoloRelease(process.argv[3]?resolve(process.argv[3]):packageDirectory).id}`);
    else{
      const server=createSoloAppServer();
      server.on('error',error=>{console.error(`Cannot start Card Duel at 127.0.0.1:${SOLO_PORT}: ${error.message}`);process.exitCode=1;});
      server.listen(SOLO_PORT,'127.0.0.1',()=>console.log(`Card Duel · ${'http://127.0.0.1:'+SOLO_PORT+'/'}\nOpen this exact address in your usual browser. Keep this window running for first setup and updates. Restart the launcher after replacing a release.`));
    }
  }catch(error){console.error(`App package invalid: ${error.message}. Extract the complete release into a new folder or rebuild it.`);process.exitCode=1;}
}
