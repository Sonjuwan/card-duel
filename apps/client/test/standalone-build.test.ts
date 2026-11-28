import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import ts from 'typescript';
import {createCatalog,practiceDeck} from '../../../packages/engine/src/index.ts';
import type {LocalRequest,LocalResponse} from '../src/local-duel.ts';
const html=readFileSync('solo-offline.html','utf8');
const js=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
const css=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
test('standalone embeds the app, all registered illustrations and no external HTML resources',()=>{
  assert.ok(js&&css);
  const backgrounds=['hall','hall-small','gallery','gallery-small','archive','archive-small','arena','arena-small','board'].map(name=>'runehall-'+name+'.webp');
  const materials=['warrior','shaman','rogue','paladin','hunter','druid','warlock','mage','priest'].map(hero=>'frame-'+hero+'.webp');
  const textures=[...backgrounds,...materials];
  assert.equal((css.match(/data:image\/webp;base64,/g)??[]).length,458+textures.length);
  for(const file of textures){
    const content=readFileSync(new URL('../src/assets/'+file,import.meta.url)).toString('base64');
    assert.ok(css.includes('data:image/webp;base64,'+content),file+' must be available offline');
  }
  assert.ok(html.includes(`<title>RUNEHALL v${JSON.parse(readFileSync('package.json','utf8')).version} · 오프라인 솔로</title>`));
  assert.doesNotMatch(css,/url\(["']?(?:https?:|\/\/|\.\/assets)/);
  assert.doesNotMatch(html.slice(0,html.indexOf('<script type="module">')),/<(?:link|script)\b[^>]*(?:src|href)=/);
  assert.match(js,/382|jaraxxus/);assert.match(js,/postMessage/);
});
test('worker embedded in the production standalone actually runs a complete game command exchange',{timeout:10000},async t=>{
  assert.ok(js);
  const source=ts.createSourceFile('offline.js',js,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const strings:string[]=[];function visit(node:ts.Node){if(ts.isStringLiteral(node)&&node.text.length>50000&&node.text.includes('postMessage'))strings.push(node.text);ts.forEachChild(node,visit);}visit(source);
  assert.equal(strings.length,1,'expected one embedded worker script');
  const worker=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.postMessage=m=>parentPort.postMessage(m);${strings[0]}\nparentPort.on('message',data=>globalThis.onmessage({data}));`,{eval:true});
  t.after(async()=>{await worker.terminate();});
  function next(predicate:(m:LocalResponse)=>boolean){return new Promise<LocalResponse>((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('Worker timeout'));},4000);const receive=(m:LocalResponse)=>{if(m.type==='error'){cleanup();reject(Error(m.error));}else if(predicate(m)){cleanup();resolve(m);}};const fail=(e:Error)=>{cleanup();reject(e);};const cleanup=()=>{clearTimeout(timer);worker.off('message',receive);worker.off('error',fail);};worker.on('message',receive);worker.on('error',fail);});}
  const catalog=createCatalog(JSON.parse(readFileSync('data/cards/v0.23.0.json','utf8')));
  const start=next(m=>m.type==='view');worker.postMessage({type:'selectSlot',slot:2});worker.postMessage({type:'start',input:{catalog,deck:practiceDeck(catalog,'mage'),heroClass:'priest',difficulty:3,seed:6422,code:'TEST'}} satisfies LocalRequest);
  const first=await start;assert.equal(first.type,'view');assert.equal(first.view.state!.phase,'mulligan');
  const ready=next(m=>m.type==='view'&&m.view.state?.phase==='playing');worker.postMessage({type:'act',requestId:1,revision:first.view.state!.revision,action:{type:'mulligan',replace:[]}} satisfies LocalRequest);
  const playing=await ready;assert.equal(playing.type,'view');assert.equal('hand' in playing.view.state!.opponent,false);
  const finished=next(m=>m.type==='view'&&m.view.status==='finished');worker.postMessage({type:'act',requestId:2,revision:playing.view.state!.revision,action:{type:'concede'}} satisfies LocalRequest);assert.equal((await finished).type,'view');
});
