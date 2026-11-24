import {restoreSoloMusic} from '../apps/client/solo-app/music-assets.mjs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,mkdirSync,readdirSync,readFileSync,rmSync,writeFileSync,copyFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {loadSoloRelease} from '../apps/cli/serve-solo-app.mjs';

/** Produce a HOSTABLE TEST PACKAGE, never a falsely labelled new game build.
 * The previously verified compiled game stays byte-for-byte unchanged; only
 * the service-worker/install-shell source is regenerated from current HEAD. */
const root=resolve(import.meta.dirname,'..');
const [candidate,out]=process.argv.slice(2);
if(!/^\d+$/.test(candidate??'')||!out)throw Error('Usage: node scripts/package-pwa-playtest.mjs CANDIDATE_NUMBER OUTPUT_DIRECTORY');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
if(git('status','--porcelain')!=='')throw Error('Refusing to package uncommitted source');
if(!git('log','-1','--format=%s').includes(`v0.${candidate}`))throw Error('Candidate version does not match HEAD');
const previous=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version;
if(!/^0\.\d+\.0$/.test(previous))throw Error('Previously built game version must be explicit');
const stable=resolve(root,'dist/solo-app');
const binaries=['game.js','game.css'];
const original=readFileSync(join(root,'solo-offline.html'),'utf8');
for(const name of binaries){const asset=readFileSync(join(stable,name),'utf8');if(!original.includes(restoreSoloMusic(asset,track=>readFileSync(join(stable,track)))))throw Error(`Stable ${name} was modified`);}
const target=resolve(out),file=join(target,`Card-Duel-PWA-playtest-v${previous}-game-v${candidate}-installer.zip`);
if(existsSync(file))throw Error('Refusing to overwrite a published playtest archive');
mkdirSync(target,{recursive:true});
const temp=mkdtempSync(join(tmpdir(),'card-duel-pwa-playtest-'));
const stage=join(temp,'Card-Duel-PWA');
try{
  mkdirSync(stage);
  const env={...process.env,CARD_DUEL_SOLO_APP_DIST_DIR:stage};
  execFileSync(process.execPath,['apps/client/test/build-solo-app.mjs'],{cwd:root,env});
  const info=loadSoloRelease(stage);
  for(const name of binaries){if(!readFileSync(join(stage,name)).equals(readFileSync(join(stable,name))))throw Error(`Stable game bytes drifted: ${name}`);}
  const files=readdirSync(stage).filter(name=>name!=='README-PLAYTEST.txt'&&name!=='CHECKSUMS.sha256').sort();
  const checksums=files.map(name=>`${createHash('sha256').update(readFileSync(join(stage,name))).digest('hex')}  ${name}`).join('\n')+'\n';
  writeFileSync(join(stage,'CHECKSUMS.sha256'),checksums);
  writeFileSync(join(stage,'README-PLAYTEST.txt'),
`Card Duel — offline-first installable web app PLAYTEST

GAME: previous Node24-verified executable v${previous}, NOT newly compiled v0.${candidate}.0.
INSTALLER: candidate v0.${candidate}.0 code, with release id ${info.id}.
STATUS: hosting and physical Android/iOS browser testing NOT performed here.

INSTALLATION
1. Extract the files and upload the CONTENTS of this folder to one HTTPS origin/path.
2. Do not open index.html as file://; service workers require HTTPS (or localhost).
3. Serve index.html with text/html; game.js/register.js/sw.js with JavaScript MIME; game.css with text/css.
4. Open the HTTPS link; use browser Install App / Add to Home Screen.
5. Launch from the Home Screen to remove browser address-bar chrome. Rotate the device to landscape if necessary.
6. During a patch, do not delete browser/site data. Keep the active match and finish/leave safely before restarting.

CHECKS
- sw.js includes SHA-256-verified assets and a rollback-safe cache protocol.
- CHECKSUMS.sha256 lists the delivered package files; compare after transfer.
- This is NOT a public live website, NOT an Android APK, and NOT the full v0.${candidate} game build.
- Slot saves reside on this origin in the device browser's IndexedDB; export backups before switching domains or clearing data.
`);
  execFileSync('zip',['-q','-9','-r',file,'Card-Duel-PWA'],{cwd:temp});
  execFileSync('unzip',['-tq',file]);
  console.log(JSON.stringify({file,verifiedGame:previous,installerCandidate:`0.${candidate}.0`,releaseId:info.id,files:files.length}));
}finally{rmSync(temp,{recursive:true,force:true});}
