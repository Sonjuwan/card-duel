import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fxNeedsCanvasAnimation} from '../src/battle-fx-model.ts';
import type {FxImpact} from '../src/battle-fx-model.ts';
import type {BattleAnimation} from '../../../packages/protocol.ts';
const cue=(kind:BattleAnimation['kind'],events?:BattleAnimation['events']):BattleAnimation=>({revision:8,actor:0,kind,...(events?{events}:{})});
test('turns and choices without public effects do not allocate paint loops',()=>{
  assert.equal(fxNeedsCanvasAnimation(cue('turn'),[]),false);
  assert.equal(fxNeedsCanvasAnimation(cue('choice'),[]),false);
  for(const kind of ['attack','heroAttack','spell','summon','power','weapon','coin','secret'] as const)assert.equal(fxNeedsCanvasAnimation(cue(kind),[]),true,kind);
});
test('real accepted results keep canvas drawing even on turn and choice events',()=>{
  const impact:FxImpact={kind:'damage',side:1,target:{kind:'hero',player:1},amount:3};
  assert.equal(fxNeedsCanvasAnimation(cue('turn'),[impact]),true);
  assert.equal(fxNeedsCanvasAnimation(cue('choice'),[impact]),true);
  assert.equal(fxNeedsCanvasAnimation(cue('turn',[{kind:'secretTriggered',side:1,cardId:'test-secret'}]),[]),true);
});
test('independent timer still schedules accepted impact when canvas is skipped',()=>{
  const source=readFileSync(new URL('../src/battle-fx.tsx',import.meta.url),'utf8');
  assert.match(source,/if\(fxNeedsCanvasAnimation\(a,impacts\)\)\{/);
  assert.match(source,/timeouts\.push\(setTimeout\(impact,cue\.impact\)\);/);
  assert.match(source,/if\(ctx\)frame=requestAnimationFrame\(paint\);/);
});
