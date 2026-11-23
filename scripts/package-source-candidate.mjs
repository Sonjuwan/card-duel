import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve,relative,sep} from 'node:path';

/** An UNVERIFIED source checkpoint is not a playable release. Bundle the
 * committed candidate together with a clearly labelled, independently
 * verified older app. In particular, data/ai is gitignored and MUST be added
 * explicitly or hard-won AI training checkpoints silently disappear. */
const project=resolve(import.meta.dirname,'..'),parent=dirname(project);
const baseCommit='7f011afbf465ad0527c55e4eb6f946957e94fc9a';
const [serial,outArg]=process.argv.slice(2);
const fail=message=>{throw Error(message);};
const check=(value,message)=>{if(!value)fail(message);};
const git=(...args)=>execFileSync('git',args,{cwd:project,encoding:'utf8'}).trim();
const run=(program,args,{cwd=project,input}={})=>{
  const result=spawnSync(program,args,{cwd,input,encoding:'utf8',maxBuffer:64*1024*1024});
  if(result.error||result.status!==0)fail(`${program}: ${result.error?.message??result.stderr?.trim()??result.status}`);
  return result.stdout;
};
const walk=dir=>readdirSync(join(project,dir),{withFileTypes:true}).flatMap(entry=>{
  const file=join(dir,entry.name);return entry.isDirectory()?walk(file):entry.isFile()?[file]:[];
});
const sha=file=>createHash('sha256').update(readFileSync(join(project,file))).digest('hex');
const zipRead=(archive,path)=>execFileSync('unzip',['-p',archive,`card-duel/${path}`],{maxBuffer:32*1024*1024});

function main(){
  check(/^\d+$/.test(serial??''),'Usage: node scripts/package-source-candidate.mjs VERSION_NUMBER OUTPUT_DIRECTORY');
  const outDir=resolve(outArg??parent);
  check(git('status','--porcelain')==='', 'Commit all changes before creating a candidate archive.');
  check(git('show','-s','--format=%s','HEAD').includes(`v0.${serial}`),'HEAD must identify the candidate version.');
  run('git',['merge-base','--is-ancestor',baseCommit,'HEAD']);
  const release=JSON.parse(git('show','HEAD:package.json')).version;
  const installer=readFileSync(join(project,'dist/solo-app/index.html'),'utf8');
  check(installer.includes(`Card Duel v${release}`),`Existing verified installer must still be v${release}; cannot label a newer binary as verified.`);
  const standalone=readFileSync(join(project,'solo-offline.html'),'utf8');
  check(standalone.includes(readFileSync(join(project,'dist/solo-app/game.js'),'utf8')),'Standalone script and installer differ.');
  check(standalone.includes(readFileSync(join(project,'dist/solo-app/game.css'),'utf8')),'Standalone styles and installer differ.');
  const additional=[...walk('dist/solo-app'),...walk('data/ai')];
  check(additional.filter(p=>p.startsWith(`data${sep}ai${sep}`)).length>=10,'Missing gitignored AI training/checkpoint files.');
  const names=additional.map(path=>`card-duel/${path.split(sep).join('/')}`);
  const stableSerial=/^0\.(\d+)\.0$/.exec(release)?.[1]??release.replaceAll('.','-');
  const archive=join(outDir,`card-duel-v${serial}-candidate-source-and-verified-v${stableSerial}-play.zip`);
  const bundle=join(outDir,`card-duel-v${serial}-candidate-git.bundle`);
  check(!existsSync(archive)&&!existsSync(bundle),'Refusing to overwrite an earlier candidate backup.');
  mkdirSync(outDir,{recursive:true});
  const temp=mkdtempSync(join(outDir,`.card-duel-v${serial}-`));
  const stagingArchive=join(temp,'candidate.zip'),stagingBundle=join(temp,'candidate.bundle');
  try{
    run('git',['archive','--format=zip','--prefix=card-duel/','HEAD','-o',stagingArchive]);
    const previews=['animation-preview.html','card-gallery.html','interface-preview.html','interface-quick.html'];
    const tracked=new Set(git('ls-files').split('\n'));
    const excluded=previews.filter(p=>tracked.has(p)).map(p=>`card-duel/${p}`);
    if(excluded.length)run('zip',['-q','-d',stagingArchive,...excluded]);
    run('zip',['-q','-9',stagingArchive,'-@'],{cwd:parent,input:names.join('\n')+'\n'});
    mkdirSync(join(temp,'card-duel'));
    writeFileSync(join(temp,'card-duel','RELEASE-STATUS.txt'),
      `v0.${serial}.0 is a SOURCE-ONLY candidate; it has NOT passed the Node24 production build or physical-device tests.\n`+
      `The included solo-offline.html and dist/solo-app are PREVIOUS VERIFIED v${release}, not compiled from v0.${serial}.0.\n`+
      'Keep existing IndexedDB saves and training checkpoints. Do not deploy the candidate without a fresh build and validation.\n');
    run('zip',['-q',stagingArchive,'card-duel/RELEASE-STATUS.txt'],{cwd:temp});
    run('unzip',['-tq',stagingArchive]);
    check(zipRead(stagingArchive,'package.json').equals(readFileSync(join(project,'package.json'))),'Candidate package differs from HEAD.');
    check(zipRead(stagingArchive,'apps/client/src/Battle.tsx').equals(readFileSync(join(project,'apps/client/src/Battle.tsx'))),'Candidate battle source differs from HEAD.');
    check(zipRead(stagingArchive,'dist/solo-app/game.js').equals(readFileSync(join(project,'dist/solo-app/game.js'))),'Previous verified script changed.');
    for(const p of additional.filter(p=>p.startsWith(`data${sep}ai${sep}`))){
      check(createHash('sha256').update(zipRead(stagingArchive,p)).digest('hex')===sha(p),`AI model backup mismatch: ${p}`);
    }
    run('git',['bundle','create',stagingBundle,'HEAD',`^${baseCommit}`]);
    run('git',['bundle','verify',stagingBundle]);
    check(git('status','--porcelain')===''&&git('show','-s','--format=%s','HEAD').includes(`v0.${serial}`),'Source changed during packaging.');
    renameSync(stagingArchive,archive);renameSync(stagingBundle,bundle);
    console.log(JSON.stringify({candidate:`v0.${serial}.0`,previous_verified:`v${release}`,commit:git('rev-parse','--short','HEAD'),archive,bundle,ai_checkpoints:additional.filter(x=>x.startsWith(`data${sep}ai${sep}`)).length}));
  }finally{rmSync(temp,{recursive:true,force:true});}
}
try{main();}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
