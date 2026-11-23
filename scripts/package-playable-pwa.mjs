import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

/** Package ONLY the already-compiled and version-labelled game executable.
 * Never silently turn a newer source-only candidate into a playable release. */
const project=resolve(import.meta.dirname,'..');
const run=(bin,args,cwd)=>{const p=spawnSync(bin,args,{cwd,encoding:'utf8'});if(p.error||p.status)throw Error(`${bin}: ${p.error?.message??p.stderr??p.status}`);};
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const sha=b=>createHash('sha256').update(b).digest('hex');
export function inspectPlayablePwa(dist=join(project,'dist/solo-app')){
  const names=['index.html','game.js','game.css','manifest.webmanifest','register.js','sw.js','icon-192.png','icon-512.png'];
  for(const name of names)assert(existsSync(join(dist,name)),`Missing release asset ${name}`);
  const read=name=>readFileSync(join(dist,name));
  const html=read('index.html').toString();
  const version=JSON.parse(readFileSync(join(project,'package.json'),'utf8')).version;
  assert(html.includes(`Card Duel v${version}`),'Installable game version must match compiled binary, never candidate source version');
  const standalone=readFileSync(join(project,'solo-offline.html'),'utf8');
  assert(standalone.includes(read('game.js').toString()),'Compiled script differs from verified standalone binary');
  assert(standalone.includes(read('game.css').toString()),'Compiled card graphics differ from verified standalone binary');
  const spec=read('sw.js').toString().match(/const release = (.+);/)?.[1];
  assert(spec,'Missing integrity manifest from service worker');
  const release=JSON.parse(spec);
  assert(/^[a-f0-9]{64}$/.test(release.id),'Invalid immutable release identifier');
  assert(Object.keys(release.files).length===7,'Unexpected pre-cached release asset count');
  for(const [name,hash] of Object.entries(release.files))assert(names.includes(name)&&sha(read(name))===hash,`Offline integrity mismatch: ${name}`);
  const manifest=JSON.parse(read('manifest.webmanifest').toString());
  assert(manifest.display==='standalone'&&manifest.orientation==='landscape','Not an installable landscape PWA');
  return {version,release:release.id,assets:names};
}
export function packagePlayablePwa(outputDir){
  const meta=inspectPlayablePwa();
  const folder=resolve(outputDir);mkdirSync(folder,{recursive:true});
  const zip=join(folder,`Card-Duel-PWA-v${meta.version}-installer.zip`);
  assert(!existsSync(zip),'Refusing to overwrite an existing installable release');
  const staging=mkdtempSync(join(folder,'.pwa-install-'));const packageDir=join(staging,'card-duel-pwa');
  try{
    mkdirSync(packageDir);for(const name of meta.assets)cpSync(join(project,'dist/solo-app',name),join(packageDir,name));
    writeFileSync(join(packageDir,'INSTALL.txt'),[
      `Card Duel PWA — compiled game v${meta.version} (immutable ${meta.release.slice(0,12)})`,
      'This package contains the compiled game and the matching offline installer.',
      'A newer source-only candidate does NOT become a playable build through this command.',
      'Upload every file in card-duel-pwa to the same HTTPS URL and keep paths unchanged.',
      'Open on a smartphone and choose Install App or Add to Home Screen. Rotate landscape if necessary.',
      'Keep the exact same origin to preserve existing local saved games. Back up data before changing domains.',
      'Not an APK, not automatically deployed, and not physically phone-tested.',
      ''
    ].join('\n'));
    run('zip',['-q','-r','-9',zip,'card-duel-pwa'],staging);
    run('unzip',['-tq',zip],staging);
    assert(readdirSync(packageDir).length===9,'Missing install instructions or compiled assets');
    return {version:meta.version,release:meta.release.slice(0,12),zip,files:9};
  }finally{rmSync(staging,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  try{console.log(JSON.stringify(packagePlayablePwa(process.argv[2]??join(project,'dist'))));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
