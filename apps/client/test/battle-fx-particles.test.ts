import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paintBurstParticles} from '../src/battle-fx-particles.ts';
import {createParticleCache,FX_COLORS} from '../src/battle-fx-model.ts';

type Trace={method:string;args:number[]};
function canvas(){
  const operations:Trace[]=[];
  const ctx={
    save(){operations.push({method:'save',args:[]});},restore(){operations.push({method:'restore',args:[]});},
    beginPath(){operations.push({method:'beginPath',args:[]});},
    moveTo(...args:number[]){operations.push({method:'moveTo',args});},
    lineTo(...args:number[]){operations.push({method:'lineTo',args});},
    arc(...args:number[]){operations.push({method:'arc',args});},
    ellipse(...args:number[]){operations.push({method:'ellipse',args});},
    translate(...args:number[]){operations.push({method:'translate',args});},
    rotate(...args:number[]){operations.push({method:'rotate',args});},
    fill(){operations.push({method:'fill',args:[]});},
    stroke(){operations.push({method:'stroke',args:[]});},
    globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1,
  };
  return {ctx:ctx as unknown as CanvasRenderingContext2D,operations};
}
test('fire, steel and shadow particles retain the same deterministic geometry with only one canvas state pair',()=>{
  for(const theme of ['fire','steel','shadow'] as const){
    const {ctx,operations}=canvas(),cache=createParticleCache(),point={x:100,y:55},t=.3,scale=1,seed=47,density=.65;
    const count=paintBurstParticles(ctx,point,t,theme,scale,seed,density,cache),first=cache(seed,scale,count)[0];
    assert.equal(count,12);assert.equal(operations.filter(o=>o.method==='save').length,1);assert.equal(operations.filter(o=>o.method==='restore').length,1);
    assert.equal(operations.filter(o=>o.method===(theme==='steel'?'stroke':'fill')).length,count);
    const p=operations.find(o=>o.method===(theme==='steel'?'moveTo':'arc'));
    assert.ok(p);assert.ok(Math.abs(p.args[0]-(point.x+first.cos*(12+125*t)*first.velocity))<1e-9);
    const expectedY=point.y+first.sin*(12+125*t)*first.velocity+(theme==='fire'?-t*t*35:0);
    assert.ok(Math.abs(p.args[1]-expectedY)<1e-9);
    assert.ok(FX_COLORS[theme].length===3);
  }
});
test('nature preserves individual leaf orientation and balances every transform while empty/end bursts skip work',()=>{
  const {ctx,operations}=canvas(),cache=createParticleCache();
  const count=paintBurstParticles(ctx,{x:10,y:20},.5,'nature',1.65,15,1,cache);
  assert.equal(count,28);
  assert.equal(operations.filter(o=>o.method==='save').length,count+1);
  assert.equal(operations.filter(o=>o.method==='restore').length,count+1);
  assert.equal(operations.filter(o=>o.method==='ellipse').length,count);
  assert.equal(paintBurstParticles(ctx,{x:10,y:20},1,'fire',1,15,1,cache),0);
  assert.equal(paintBurstParticles(ctx,{x:10,y:20},.3,'fire',1,15,0,cache),0);
});
