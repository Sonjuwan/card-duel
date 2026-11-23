import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

/** Only alter metadata in a temporary build checkout, never in source-only
 * candidate backups. Without this step an updated PWA still displays the
 * previous fully verified v0.197 version and can mislead users. */
export function stampCandidateManifests(packageData,lockData,serial){
  if(typeof serial!=='string'||!/^[1-9]\d{0,5}$/.test(serial))throw Error('Expected numeric candidate version');
  if(!/^0\.\d+\.0$/.test(packageData?.version)||packageData.version!==lockData?.version||packageData.version!==lockData?.packages?.['']?.version)throw Error('Original package and lock metadata differ');
  const next=`0.${serial}.0`;
  if(next===packageData.version)throw Error('Candidate must be different from the already built release');
  const manifest={...packageData,version:next};
  const lock={...lockData,version:next,packages:{...lockData.packages,'':{...lockData.packages[''],version:next}}};
  return{manifest,lock,version:next};
}

function main(){
  const serial=process.argv[2],cwd=resolve(process.cwd());
  if(execFileSync('git',['status','--porcelain'],{cwd,encoding:'utf8'}).trim())throw Error('Build checkout must be clean before stamping');
  const head=execFileSync('git',['log','-1','--pretty=%s'],{cwd,encoding:'utf8'}).trim();
  if(!new RegExp(`^Candidate v0\\.${serial}:`).test(head))throw Error(`Expected latest source commit for v0.${serial}, found: ${head}`);
  const file=resolve(cwd,'package.json'),lockFile=resolve(cwd,'package-lock.json');
  const manifest=JSON.parse(readFileSync(file,'utf8')),lock=JSON.parse(readFileSync(lockFile,'utf8'));
  const version=`0.${serial}.0`;
  if(/^[1-9]\d{0,5}$/.test(serial)&&manifest.version===version&&lock.version===version&&lock.packages?.['']?.version===version){
    console.log(`Validating already stamped Card Duel v${version}.`);
    return;
  }
  const result=stampCandidateManifests(manifest,lock,serial);
  writeFileSync(file,JSON.stringify(result.manifest,null,2)+'\n');
  writeFileSync(lockFile,JSON.stringify(result.lock,null,2)+'\n');
  console.log(`Validating and building Card Duel v${result.version} (candidate; promotion requires all tests)`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{main();}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
