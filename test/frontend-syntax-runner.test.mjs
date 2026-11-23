import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const script=readFileSync(new URL('scripts/check-frontend-syntax.mjs',root),'utf8');
const manifest=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
const pipeline=readFileSync(new URL('.github/workflows/validate-playable.yml',root),'utf8');
test('a standalone frontend syntax check is explicit about its limitations',()=>{
  assert.equal(manifest.scripts['check:frontend-syntax'],'node scripts/check-frontend-syntax.mjs');
  assert.match(script,/createSourceFile\(/);
  assert.match(script,/parseDiagnostics/);
  assert.match(script,/typechecking:false,browserE2E:false/);
  assert.match(pipeline,/npm run check:frontend-syntax[\s\S]*?npm run typecheck/);
  // Keep the dependency-free core game suite working when TypeScript is absent.
  assert.doesNotMatch(manifest.scripts['test:playable-core'],/check:frontend-syntax/);
});
