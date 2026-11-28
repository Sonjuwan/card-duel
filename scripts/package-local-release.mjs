import {musicAssets,restoreSoloMusic} from '../apps/client/solo-app/music-assets.mjs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync,cpSync,existsSync,readFileSync,readdirSync,renameSync,rmSync,statSync,unlinkSync} from 'node:fs';
import {dirname,join,resolve,sep} from 'node:path';

/** Package only committed, fully built offline releases. Unlike zipping the
 * working directory, git archive cannot accidentally pick up the next edit. */
const project=resolve(import.meta.dirname,'..'),parent=dirname(project);
const baseCommit='7f011afbf465ad0527c55e4eb6f946957e94fc9a';
const previews=['animation-preview.html','card-gallery.html','interface-preview.html','interface-quick.html'];
const git=(...args)=>execFileSync('git',args,{cwd:project,encoding:'utf8'}).trim();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=file=>readFileSync(join(project,file));
const run=(program,args,options={})=>{
  const result=spawnSync(program,args,{cwd:project,encoding:'utf8',maxBuffer:8*1024*1024,...options});
  if(result.error||result.status!==0)throw Error(`${program} failed: ${result.error?.message??result.stderr?.trim()??result.status}`);
  return result.stdout;
};
const check=(condition,message)=>{if(!condition)throw Error(message);};
const unpack=(zip,file)=>execFileSync('unzip',['-p',zip,`card-duel/${file}`],{cwd:project,maxBuffer:32*1024*1024});
const walk=dir=>readdirSync(join(project,dir),{withFileTypes:true}).flatMap(entry=>{
  const path=join(dir,entry.name);return entry.isDirectory()?walk(path):entry.isFile()?[path]:[];
});

function main(){
  check(git('status','--porcelain').length===0,'Working tree is dirty. Commit the complete tested release before packaging.');
  check(git('rev-parse','--show-toplevel')===project,'Run inside the Card Duel repository.');
  const startingHead=git('rev-parse','HEAD');
  const committedPackage=git('show','HEAD:package.json'),manifest=JSON.parse(committedPackage),version=manifest.version;
  check(typeof version==='string'&&/^\d+\.\d+\.\d+$/.test(version),'Invalid committed package version.');
  check(readFileSync(join(project,'package.json'),'utf8')===committedPackage+'\n'||readFileSync(join(project,'package.json'),'utf8')===committedPackage,'Current package differs from HEAD.');
  const serial=version.startsWith('0.')&&version.endsWith('.0')?version.split('.')[1]:version.replaceAll('.','-');
  const prefix=`card-duel-v${serial}`;
  const archive=join(parent,`${prefix}-source-and-play.zip`),bundle=join(parent,`${prefix}-git-increment.bundle`),html=join(parent,`Card-Duel-v${version}.html`),snapshot=join(parent,`v${serial}-solo-app`);
  for(const target of [archive,bundle,html,snapshot])check(!existsSync(target),`Release output already exists: ${target}`);
  const installationFiles=[...musicAssets,'index.html','game.js','game.css','manifest.webmanifest','register.js','icon-192.png','icon-512.png'];
  const solo=readFileSync(join(project,'solo-offline.html'),'utf8');
  const app=readFileSync(join(project,'dist/solo-app/index.html'),'utf8');
  check(['RUNEHALL','Card Duel'].some(name=>app.includes(`${name} v${version}`)),'Installable app version does not match the committed release. Rebuild first.');
  const embeddedScript=solo.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1],embeddedCss=solo.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  check(embeddedScript!==undefined&&embeddedCss!==undefined,'Standalone HTML is incomplete.');
  check(embeddedScript===restoreSoloMusic(bytes('dist/solo-app/game.js').toString(),name=>bytes('dist/solo-app/'+name))&&embeddedCss===bytes('dist/solo-app/game.css').toString(),'Standalone and installable game assets differ. Rebuild and verify.');
  const sw=bytes('dist/solo-app/sw.js').toString(),match=sw.match(/const release = (.+);/);
  check(!!match,'Installable service worker lacks its release specification.');
  const release=JSON.parse(match[1]);
  check(installationFiles.length===Object.keys(release.files).length,'Unexpected installable file count.');
  for(const name of installationFiles)check(release.files[name]===hash(bytes(`dist/solo-app/${name}`)),`Installable file is damaged or stale: ${name}`);
  check(git('cat-file','-t',baseCommit)==='commit','Incremental base commit unavailable.');
  run('git',['merge-base','--is-ancestor',baseCommit,'HEAD']);
  const extras=[...walk('dist/solo-app'),...walk('data/ai')].map(path=>`card-duel/${path.split(sep).join('/')}`);
  check(extras.length>=installationFiles.length+1,'Missing offline package or AI data.');
  const outputs=[archive,bundle,html,snapshot],created=[],temporary=[`${archive}.part-${process.pid}.zip`,`${bundle}.part-${process.pid}`,`${html}.part-${process.pid}`,`${snapshot}.part-${process.pid}`];
  try{
    for(const path of temporary)check(!existsSync(path),`Temporary release output already exists: ${path}`);
    run('git',['archive','--format=zip','--prefix=card-duel/','HEAD','-o',temporary[0]]);
    const tracked=git('ls-files').split('\n');
    const excludes=previews.filter(file=>tracked.includes(file)).map(file=>`card-duel/${file}`);
    if(excludes.length)run('zip',['-q','-d',temporary[0],...excludes]);
    run('zip',['-q','-9',temporary[0],'-@'],{cwd:parent,input:extras.join('\n')+'\n'});
    run('unzip',['-tq',temporary[0]]);
    check(unpack(temporary[0],'package.json').toString()===readFileSync(join(project,'package.json'),'utf8'),'Archive source differs from committed package.');
    check(unpack(temporary[0],'apps/client/src/App.tsx').equals(bytes('apps/client/src/App.tsx')),'Archive app source differs from HEAD.');
    run('git',['bundle','create',temporary[1],'HEAD',`^${baseCommit}`]);
    run('git',['bundle','verify',temporary[1]]);
    copyFileSync(join(project,'solo-offline.html'),temporary[2]);
    check(statSync(temporary[2]).size>10*1024*1024,'Standalone HTML unexpectedly small.');
    cpSync(join(project,'dist/solo-app'),temporary[3],{recursive:true,force:false,errorOnExist:true});
    check(readdirSync(temporary[3]).length===installationFiles.length+1,'Previous-release install snapshot is incomplete.');
    for(const name of installationFiles)check(hash(readFileSync(join(temporary[3],name)))===release.files[name],`Previous-release snapshot differs: ${name}`);
    check(hash(readFileSync(join(temporary[3],'sw.js')))===hash(bytes('dist/solo-app/sw.js')),'Previous-release service worker snapshot differs.');
    check(git('rev-parse','HEAD')===startingHead&&git('status','--porcelain').length===0,'Source changed during packaging; no release outputs were published.');
    for(let i=0;i<temporary.length;i++){
      renameSync(temporary[i],outputs[i]);created.push(outputs[i]);
    }
    console.log(`Packaged committed v${version} (${git('rev-parse','--short','HEAD')})`);
    for(const output of created)console.log(`${output} | ${output===snapshot?'verified previous-release install snapshot':hash(readFileSync(output))}`);
  }finally{
    for(const [i,path] of temporary.entries())if(existsSync(path)){if(i===3)rmSync(path,{recursive:true,force:true});else unlinkSync(path);}
  }
}

try{main();}catch(error){console.error(`Release packaging failed: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1;}
