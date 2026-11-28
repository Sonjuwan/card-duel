import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../apps/client/src/'+name,import.meta.url),'utf8');
test('audio and visual settings have separate controls and keep the previous volume keys',()=>{
  const settings=read('battle-dialogue-ui.tsx'),audio=read('AudioMixer.tsx'),sound=read('battle-sound.ts');
  assert.match(settings,/aria-label="오디오".*[\s\S]*?<AudioMixer includeEffects\/>/);
  assert.match(settings,/aria-label="전투 연출"/);
  assert.match(audio,/전체 음소거/);
  assert.match(audio,/setBattleEffectsSound\(!effects\)/);
  for(const key of ['card-duel-sound','card-duel-master-volume','card-duel-sound-volume','card-duel-dialogue-volume'])assert.ok(sound.includes(key));
});
