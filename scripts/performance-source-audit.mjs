import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import assert from 'node:assert/strict';
const config=ts.readConfigFile(resolve('tsconfig.json'),ts.sys.readFile);
if(config.error)throw Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd(),{noUnusedLocals:true,noUnusedParameters:true,noEmit:true});
const program=ts.createProgram(parsed.fileNames,parsed.options);
const unused=ts.getPreEmitDiagnostics(program).filter(d=>[6133,6192,6196,6198].includes(d.code)).map(d=>{
  const loc=d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start):undefined;
  return {file:d.file?relative(process.cwd(),d.file.fileName):null,line:loc?loc.line+1:null,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')};
});
const source=readFileSync('apps/client/src/game-styles.ts','utf8');
const layers=[...source.matchAll(/^import '\.\/([^']+\.css)';$/gm)].map(m=>m[1]);
assert.equal(new Set(layers).size,layers.length);
console.log(JSON.stringify({unused,styles:layers.map(name=>({name,bytes:Buffer.byteLength(readFileSync('apps/client/src/'+name))})),note:'Review unused diagnostics individually. Exported public entry points and dynamic CSS selectors cannot be safely removed from compiler diagnostics alone.'},null,2));
