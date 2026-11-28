import {restoreSoloMusic} from '../apps/client/solo-app/music-assets.mjs';
/** Build a REAL playable version from a source-only candidate ZIP on a user
 * computer with Node 24 and internet access. This is not an alternate game
 * implementation or a shortcut around the complete validation gates. */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {stampCandidateManifests} from './stamp-candidate-build.mjs';
import {packagePlayablePwa} from './package-playable-pwa.mjs';

const project=resolve(import.meta.dirname,'..');
const fail=(message)=>{throw new Error(message);};
const safeHash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');

export function candidateFromReleaseStatus(status){
  if(typeof status!=='string')fail('Missing source-only release status. Use the complete candidate source ZIP.');
  const version=status.match(/^v0\.([1-9]\d{0,5})\.0 is a SOURCE-ONLY candidate;/m)?.[1]
    ??status.match(/^v0\.([1-9]\d{0,5})\.0 fully built in Node24 and passed automated gates\./m)?.[1];
  const previous=status.match(/PREVIOUS VERIFIED v(0\.\d+\.0)/)?.[1];
  if(!version||!previous||Number(version)<=Number(previous.split('.')[1]))
    fail('Invalid candidate release marker. Refusing to mislabel an older executable as a new build.');
  return {number:version,version:`0.${version}.0`,previous};
}

export function planLocalBuild({nodeMajor,releaseStatus,manifest,lock}){
  const candidate=candidateFromReleaseStatus(releaseStatus);
  if(nodeMajor!==24)fail(`Node.js 24 required, found ${nodeMajor}. Install Node.js 24 and retry; no files were modified.`);
  if(manifest?.version!==lock?.version||manifest?.version!==lock?.packages?.['']?.version)
    fail('package.json and package-lock.json versions differ.');
  if(manifest.version===candidate.version)return {...candidate,stamp:null,alreadyStamped:true};
  if(manifest.version!==candidate.previous)fail('The candidate metadata does not match the last verified game.');
  const stamp=stampCandidateManifests(manifest,lock,candidate.number);
  return {...candidate,stamp,alreadyStamped:false};
}

function command(program,args){
  console.log(`\n> ${program} ${args.join(' ')}`);
  const result=spawnSync(program,args,{cwd:project,stdio:'inherit',shell:process.platform==='win32'});
  if(result.error||result.status!==0)fail(`${program} ${args.join(' ')} failed (${result.error?.message??`exit ${result.status}`}).`);
}

/** Verify all outputs before the report names them playable. */
function verifyOutputs(version,out){
  const index=readFileSync(join(project,'dist/solo-app/index.html'),'utf8');
  if(!['RUNEHALL','Card Duel'].some(name=>index.includes(`${name} v${version}`)))fail('Compiled PWA displays the wrong release version.');
  const standalone=join(project,'solo-offline.html');
  const html=readFileSync(standalone,'utf8');
  if(!html.includes(restoreSoloMusic(readFileSync(join(project,'dist/solo-app/game.js'),'utf8'),name=>readFileSync(join(project,'dist/solo-app',name))))||
     !html.includes(readFileSync(join(project,'dist/solo-app/game.css'),'utf8')))
    fail('Compiled standalone HTML does not match the new PWA executable.');
  const target=join(out,`RUNEHALL-v${version}-standalone.html`);
  if(existsSync(target))fail(`Existing release must not be overwritten: ${target}`);
  cpSync(standalone,target);
  const pwa=packagePlayablePwa(out);
  if(pwa.version!==version)fail('PWA package version unexpectedly differs.');
  const report=join(out,`RUNEHALL-v${version}-VALIDATION.txt`);
  writeFileSync(report,[
    `RUNEHALL v${version} — locally compiled playable candidate`,
    'Completed successfully: Node24 npm ci, data integrity, syntax, typecheck,',
    'core regression, full tests, 2 real engine matches, React render,',
    'web build, offline/PWA build, PWA upgrade/rollback and deployment preflight.',
    'This is NOT confirmation of real Android/iPhone touch or audio tests.',
    'To install, host the PWA ZIP contents over HTTPS on the SAME ORIGIN as your',
    'existing RUNEHALL installation to preserve browser saved games.',
    'Standalone HTML is for local file play, not for automatic PWA updates.',
    `Standalone SHA256: ${safeHash(target)}`,
    `PWA ZIP SHA256: ${safeHash(pwa.zip)}`,
    ''
  ].join('\n'));
  return {standalone:target,pwa:pwa.zip,report};
}

function main(){
  const statusPath=join(project,'RELEASE-STATUS.txt');
  if(!existsSync(statusPath))fail('RELEASE-STATUS.txt not found. Extract a complete candidate source ZIP first.');
  const status=readFileSync(statusPath,'utf8');
  const pkg=join(project,'package.json'),lockfile=join(project,'package-lock.json');
  const rawPkg=readFileSync(pkg,'utf8'),rawLock=readFileSync(lockfile,'utf8');
  const plan=planLocalBuild({nodeMajor:Number(process.versions.node.split('.')[0]),releaseStatus:status,manifest:JSON.parse(rawPkg),lock:JSON.parse(rawLock)});
  const output=resolve(process.argv[2]??join(project,'playable-release'));
  if(existsSync(join(output,`RUNEHALL-PWA-v${plan.version}-installer.zip`))||
     existsSync(join(output,`RUNEHALL-v${plan.version}-standalone.html`)))
    fail('That release already exists. Do not overwrite a previously verified artifact.');
  // A failed build must NEVER replace the old playable binary in the source ZIP.
  const temp=mkdtempSync(join(tmpdir(),'card-duel-safe-build-'));
  const oldApp=join(project,'dist/solo-app'),oldSolo=join(project,'solo-offline.html');
  const hadApp=existsSync(oldApp),hadSolo=existsSync(oldSolo);
  if(hadApp)cpSync(oldApp,join(temp,'solo-app'),{recursive:true});
  if(hadSolo)cpSync(oldSolo,join(temp,'solo-offline.html'));
  let completed=false;
  try{
    console.log(`Preparing RUNEHALL v${plan.version} from verified v${plan.previous} source snapshot.`);
    // Install against ORIGINAL lock metadata first. Never substitute unpinned dependencies.
    command('npm',['ci','--no-audit','--no-fund']);
    command('npm',['run','verify:release-baseline']);
    if(plan.stamp){writeFileSync(pkg,JSON.stringify(plan.stamp.manifest,null,2)+'\n');writeFileSync(lockfile,JSON.stringify(plan.stamp.lock,null,2)+'\n');}
    command('npm',['run','check:frontend-syntax']);
    command('npm',['run','typecheck']);
    // Some core regressions inspect the freshly compiled standalone and PWA.
    command('npm',['run','test:solo-app']);
    command('npm',['run','test:playable-core']);
    command('npm',['test']);
    command('npm',['run','test:solo-journey']);
    command('npm',['run','test:render']);
    command('npm',['run','build']);
    // Build a genuinely playable release only after Chromium checks both
    // saved-game offline continuity and landscape touch-sized UI. No silently
    // skipped browser tests in the final release gate.
    command('npx',['playwright','install','chromium']);
    command('npm',['run','test:solo-app-browser']);
    command('npm',['run','test:landscape-browser']);
    command('npm',['run','verify:deployment']);
    command('npm',['run','test:package-pwa']);
    mkdirSync(output,{recursive:true});
    const products=verifyOutputs(plan.version,output);
    writeFileSync(statusPath,`v${plan.version} fully built in Node24 and passed automated gates. Real-device testing and online deployment are still pending.\nBuild baseline: PREVIOUS VERIFIED v${plan.previous}.\n`);
    completed=true;
    console.log(JSON.stringify({status:'playable-build-verified',version:plan.version,...products},null,2));
  }finally{
    if(!completed){
      writeFileSync(pkg,rawPkg);writeFileSync(lockfile,rawLock);
      if(existsSync(oldApp))rmSync(oldApp,{recursive:true,force:true});
      if(hadApp)cpSync(join(temp,'solo-app'),oldApp,{recursive:true});
      if(hadSolo)cpSync(join(temp,'solo-offline.html'),oldSolo);
      else rmSync(oldSolo,{force:true});
      // Remove only outputs from this unsuccessful release, not other builds.
      const zip=join(output,`RUNEHALL-PWA-v${plan.version}-installer.zip`);
      const html=join(output,`RUNEHALL-v${plan.version}-standalone.html`);
      const report=join(output,`RUNEHALL-v${plan.version}-VALIDATION.txt`);
      for(const file of [zip,html,report])if(existsSync(file))rmSync(file,{force:true});
      console.error('FAILED: original playable game and version metadata restored; no new release promoted.');
    }
    rmSync(temp,{recursive:true,force:true});
  }
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  try{main();}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
