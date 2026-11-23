/** Fast syntax-only preflight when a complete Node24/Vite/React environment is
 * unavailable. This DOES NOT replace TypeScript types, React render or E2E.
 * TypeScript ships in the pinned devDependencies on a normal install. */
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=resolve(import.meta.dirname,'..');
const files=[];
function gather(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){
  const file=join(dir,entry.name);
  if(entry.isDirectory())gather(file);
  else if(entry.isFile()&&/\.(?:ts|tsx)$/.test(entry.name))files.push(file);
}}
gather(join(root,'apps/client/src'));
for(const file of ['apps/client/offline-main.tsx','apps/client/main.tsx']){
  try{readFileSync(join(root,file));files.push(join(root,file));}catch{}
}
if(files.length<40)throw Error(`Missing frontend files: ${files.length}`);
let failures=0;
for(const file of files){
  const code=readFileSync(file,'utf8');
  const parsed=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,extname(file)==='.tsx'?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  for(const diag of parsed.parseDiagnostics){
    failures++;
    const pos=parsed.getLineAndCharacterOfPosition(diag.start??0);
    console.error(`${file.slice(root.length+1)}:${pos.line+1}:${pos.character+1}: ${ts.flattenDiagnosticMessageText(diag.messageText,' ')}`);
  }
}
if(failures)process.exitCode=1;
else console.log(JSON.stringify({status:'syntax-only-passed',files:files.length,typescript:ts.version,typechecking:false,browserE2E:false}));
