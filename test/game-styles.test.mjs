import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../apps/client/src/'+name,import.meta.url),'utf8');
test('online and offline use exactly the same ordered CSS cascade',()=>{
  const layers=[...read('game-styles.ts').matchAll(/^import '\.\/([^']+\.css)';$/gm)].map(m=>m[1]);
  assert.deepEqual(layers,['styles.css','battle.css','classic-table.css','local-cards.css','painted-art.css','hover-preview.css','battle-fx.css','landscape-combat.css','landscape-shell.css','classic-readability.css','slot-flow.css','battle-immersive.css','integrated-ui.css','collection-layout.css','card-materials.css','battle-settings.css','quests.css','runehall.css','runehall-graphics.css','runehall-combat.css','runehall-book-type.css','runehall-minion-status.css','runehall-action-glow.css']);
  assert.equal(new Set(layers).size,layers.length);
  for(const name of ['main.tsx','offline-main.tsx']){
    const source=read(name);
    assert.equal(source.split("import './game-styles.ts';").length,2);
    assert.doesNotMatch(source,/^import ['"][^'"]+\.css['"]/m);
  }
});
