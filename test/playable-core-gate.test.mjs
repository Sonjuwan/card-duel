import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const workflow=readFileSync(new URL('../.github/workflows/validate-playable.yml',import.meta.url),'utf8');
test('playable core is independent of server, graphics renderer and unfinished AI strength training',()=>{
  const command=manifest.scripts['test:playable-core'];
  for(const path of ['packages/engine/test/*.test.ts','apps/client/test/local-duel.test.ts','apps/client/test/storage.test.ts','apps/client/test/battle-actions.test.ts','apps/client/test/touch-gesture.test.ts','test/*.test.mjs'])assert.ok(command.includes(path),path);
  assert.doesNotMatch(command,/apps\/server|benchmark:ladder|test:ladder|test:render|playwright|ai:train/);
});
test('Node 24 CI requires playable core success before full game compilation',()=>{
  const core=workflow.indexOf('run: npm run test:playable-core'),full=workflow.indexOf('run: npm test'),build=workflow.indexOf('run: npm run build');
  assert.ok(core>0&&full>core&&build>full);
  assert.match(workflow,/node-version: '24'/);
});
