import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {landscapeHandPreviewShift,dismissPeekOnHandFocus} from '../apps/client/src/landscape-hand-preview.ts';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('center cards remain centered and edge cards cannot disappear beyond the field',()=>{
  for(const fieldWidth of [320,390,568,932]){
    const cardWidth=Math.max(18,Math.min(60,(fieldWidth-72-52)/10));
    const fieldLeft=24,fieldRight=fieldWidth-72,openWidth=Math.max(102,Math.min(158,fieldWidth*.17));
    const count=10,stripWidth=count*cardWidth+9*2;
    for(let i=0;i<count;i++){
      const left=fieldLeft+(fieldRight-fieldLeft-stripWidth)/2+i*(cardWidth+2);
      const shift=landscapeHandPreviewShift(left,cardWidth,openWidth,fieldLeft,fieldRight);
      const expanded=left+(cardWidth-openWidth)/2+shift;
      assert.ok(expanded>=fieldLeft+5.9,`left clipped: ${fieldWidth}/${i}`);
      assert.ok(expanded+openWidth<=fieldRight-5.9,`right clipped: ${fieldWidth}/${i}`);
    }
  }
});
test('oversize split-screen previews center safely instead of drifting offscreen',()=>{
  assert.equal(landscapeHandPreviewShift(25,20,120,0,90),10);
  assert.equal(landscapeHandPreviewShift(25,0,120,0,90),0);
  assert.equal(landscapeHandPreviewShift(NaN,20,120,0,90),0);
});
test('hand previews stay below the friendly row and resize with the arena',()=>{
  const css=read('../apps/client/src/integrated-ui.css');
  const source=read('../apps/client/src/Battle.tsx');
  assert.match(css,/var\(--hand-preview-y,0px\)/);
  assert.match(css,/var\(--hand-preview-width,100%\)/);
  assert.match(source,/ownBoard\?\.getBoundingClientRect\(\).bottom/);
  assert.match(source,/landscapeHandPreviewShift\(box.left,box.width,width/);
  assert.match(source,/window.addEventListener\('resize',queue\)/);
  assert.match(source,/observer\?\.disconnect\(\)/);
});

test('keyboard hand navigation preserves only the card currently in focus',()=>{
  assert.equal(dismissPeekOnHandFocus('cardA','card:cardA'),false);
  assert.equal(dismissPeekOnHandFocus('cardA','card:cardB'),true);
  assert.equal(dismissPeekOnHandFocus('cardA',undefined),true);
  assert.equal(dismissPeekOnHandFocus(null,'card:cardB'),false);
  const source=read('../apps/client/src/Battle.tsx');
  assert.match(source,/onFocusCapture=\{e=>\{if\(dismissPeekOnHandFocus\(peekCardId/);
  assert.match(source,/onBlurCapture=\{e=>\{if\(!\(e.relatedTarget instanceof Node\)/);
});
