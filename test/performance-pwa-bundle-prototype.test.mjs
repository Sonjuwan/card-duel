import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitPaintedRules} from '../scripts/performance-pwa-bundle-prototype.mjs';
const knight='.painted-art.art-knight{background-image:url(data:image/webp;base64,QUJD)}';
const wolf='.painted-art.art-wolf{background-image:url("data:image/webp;base64,REVG")}';
const other='.painted-art{background-size:cover}';
test('grouped art retains selector order and exact image URLs, with stable membership',()=>{
  for(const count of [4,8,16,32]){
    const original=knight+other+wolf,first=splitPaintedRules(original,count),second=splitPaintedRules(wolf+other+knight,count);
    assert.equal(first.artCount,2);assert.equal(first.files.size,count);
    assert.equal(first.main.toString(),'.painted-art.art-knight{background-image:var(--cd-bundle-art-knight)}'+other+'.painted-art.art-wolf{background-image:var(--cd-bundle-art-wolf)}');
    assert.deepEqual(first.files,second.files);
    const edited=splitPaintedRules(original.replace('QUJD','R0hJ'),count);
    assert.equal([...first.files].filter(([name,b])=>!b.equals(edited.files.get(name))).length,1);
    assert.ok(first.main.equals(edited.main));
  }
});
test('unsupported declarations and colliding identifiers fail closed',()=>{
  assert.throws(()=>splitPaintedRules(knight+knight),/Repeated/);
  assert.throws(()=>splitPaintedRules(knight+'.other{background:url(data:image/webp;base64,QUJD)}'),/remaining WebP/);
  assert.throws(()=>splitPaintedRules(knight+':root{--cd-bundle-art-knight:0}'),/Reserved/);
  assert.throws(()=>splitPaintedRules(other),/No supported/);
  assert.throws(()=>splitPaintedRules(knight,7),/Expected/);
});
