import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
import {once} from 'node:events';
import {createDuelServer,loadCatalog} from '../../server/server.ts';
import {PAINTED_ASSETS} from '../src/painted-art-model.ts';

const preview=readFileSync('interface-preview.html','utf8'),gallery=readFileSync('card-gallery.html','utf8');
const quick=readFileSync('interface-quick.html','utf8');
test('animation lab bundles all local images and a syntactically valid offline playback script',()=>{
  const demo=readFileSync('animation-preview.html','utf8'),css=demo.match(/<style>([\s\S]*?)<\/style>/)?.[1];assert.ok(css);
  assert.equal((css.match(/data:image\/webp;base64,/g)??[]).length,427);
  assert.ok(!/url\(["']?(?:https?:|\/\/|\.\/assets)/.test(css));
  const script=demo.slice(demo.indexOf('<script>')+8,demo.lastIndexOf('</script>'));
  assert.doesNotThrow(()=>new Script(script));assert.match(script,/전투 연출 체험장/);assert.match(script,/상대 행동/);assert.match(script,/하수인 공격·사망/);
});
test('battle-only preview contains all and only needed paintings, templates and hover code',()=>{
  assert.ok(Buffer.byteLength(quick)<1500000,'lightweight preview must remain under 1.5 MB');
  assert.ok(Buffer.byteLength(quick)<Buffer.byteLength(preview)/3);
  const used=new Set([...quick.matchAll(/data-art-asset="([^"]+)"/g)].map(m=>m[1]));
  const actual=new Map([...quick.matchAll(/\.painted-art\.art-([a-z-]+)\{background-image:url\("data:image\/webp;base64,([A-Za-z0-9+/=]+)"\)\}/g)].map(m=>[m[1],m[2]]));
  assert.deepEqual(new Set(actual.keys()),used);
  for(const [name,encoded] of actual)assert.deepEqual(Buffer.from(encoded,'base64'),readFileSync('apps/client/src/assets/illustrations/'+name+'.webp'));
  for(const m of quick.matchAll(/data-preview-(?:card|minion)="([^"]+)"/g))assert.ok(quick.includes(`data-preview-template="${m[1]}"`),m[1]);
  assert.equal(quick.match(/<script>[\s\S]*?<\/script>/)?.[0],preview.match(/<script>[\s\S]*?<\/script>/)?.[0]);
  assert.ok(!/url\(["']?(?:https?:|\/\/|\.\/assets)/.test(quick));
});
function runtime(){
  type Handler=(e:{target:FakeNode;relatedTarget?:FakeNode|null;pointerType?:string;key?:string})=>void;
  let now=0,seq=0,popup:FakeNode|null=null;
  const tasks=new Map<number,{due:number;fn:()=>void}>(),listeners=new Map<string,Handler[]>();
  class FakeNode{
    hidden=false;isConnected=true;textContent='';parent:FakeNode|null=null;
    classes=new Set<string>();mana=new FakeText();
    classList={toggle:(name:string,flag:boolean)=>flag?this.classes.add(name):this.classes.delete(name)};
    dataset:Record<string,string>;x:number;
    constructor(dataset:Record<string,string>={},x=20){this.dataset=dataset;this.x=x;}
    closest(selector:string):FakeNode|null{
      const key=({'[data-preview-card]':'previewCard','[data-set-filter]':'setFilter','[data-demo-set]':'demoSet'} as Record<string,string>)[selector];
      return key&&key in this.dataset?this:this.parent?.closest(selector)??null;
    }
    matches(){return true;}
    contains(node:FakeNode){return node===this||node.parent===this;}
    getBoundingClientRect(){return{left:this.x,width:70};}
    querySelector(){return this.mana;}
    cloneNode(){return new FakeNode({...this.dataset});}
    remove(){if(popup===this)popup=null;}
    get content(){return {firstElementChild:new FakeNode({template:this.dataset.previewTemplate})};}
  }
  class FakeText{textContent='';}
  const templates=['spell','friendly','enemy'].map(previewTemplate=>new FakeNode({previewTemplate}));
  const views=['all','basic','original'].map(demoSet=>{const view=new FakeNode({demoSet});view.hidden=demoSet!=='all';return view;});
  const addEventListener=(type:string,fn:Handler)=>{listeners.set(type,[...listeners.get(type)??[],fn]);};
  const document={querySelectorAll:(s:string)=>s.includes('template')?templates:views,body:{append:(node:FakeNode)=>{popup=node;}},addEventListener};
  const js=preview.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(js,'offline interaction script');
  runInNewContext(js,{document,window:{addEventListener},innerWidth:1366,Node:FakeNode,setTimeout:(fn:()=>void,ms:number)=>{tasks.set(++seq,{fn,due:now+ms});return seq;},clearTimeout:(id:number)=>tasks.delete(id)});
  const tick=(ms:number)=>{now+=ms;for(const [id,task] of tasks){if(task.due<=now){tasks.delete(id);task.fn();}}};
  const emit=(event:string,target:FakeNode,rest:Partial<Parameters<Handler>[0]>={})=>{for(const handler of listeners.get(event)??[])handler({target,...rest});};
  return{FakeNode,views,tick,emit,popup:()=>popup};
}
test('offline HTML embeds all 427 locally generated images once, and gallery shows all 443 definitions',()=>{
  for(const html of [preview,gallery]){
    const css=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];assert.ok(css);
    const images=[...css.matchAll(/\.painted-art\.art-([a-z-]+)\{background-image:url\("data:image\/webp;base64,([A-Za-z0-9+/=]+)"\)\}/g)];
    assert.equal(images.length,427);
    for(const [_,name,base64] of images)assert.deepEqual(Buffer.from(base64,'base64'),readFileSync('apps/client/src/assets/illustrations/'+name+'.webp'));
    assert.ok(!/url\(["']?(?:https?:|\/\/|\.\/assets)/.test(css));
  }
  const content=gallery.slice(gallery.indexOf('<main'),gallery.indexOf('</main>'));
  assert.equal((content.match(/class="gallery-card"/g)??[]).length,443);
});
test('offline hover script uses one-second dwell, shows public hand and minions only, and cancels correctly',()=>{
  const f=runtime(),hand=new f.FakeNode({previewCard:'spell',previewCost:'2'}),own=new f.FakeNode({previewCard:'card',previewMinion:'friendly'}),enemy=new f.FakeNode({previewCard:'card',previewMinion:'enemy'},1000),hidden=new f.FakeNode();
  f.emit('pointerover',hand,{pointerType:'mouse'});f.tick(999);assert.equal(f.popup(),null);f.tick(1);assert.equal(f.popup()?.dataset.template,'spell');assert.equal(f.popup()?.mana.textContent,'2');
  f.emit('pointerout',hand,{relatedTarget:own});assert.equal(f.popup(),null);
  f.emit('pointerover',own,{pointerType:'mouse'});f.tick(800);f.emit('pointerout',own,{relatedTarget:enemy});f.emit('pointerover',enemy,{pointerType:'mouse'});f.tick(999);assert.equal(f.popup(),null);f.tick(1);assert.equal(f.popup()?.dataset.template,'enemy');assert.ok(f.popup()?.classes.has('hover-left'));
  f.emit('keydown',enemy,{key:'Escape'});assert.equal(f.popup(),null);f.emit('pointerover',hidden,{pointerType:'mouse'});f.tick(1000);assert.equal(f.popup(),null);
  f.emit('pointerout',hidden,{relatedTarget:null}); // leaving ordinary areas must never throw
});
test('offline deck set tabs switch between pre-rendered all, basic and original cards',()=>{
  const f=runtime(),basic=new f.FakeNode({setFilter:'basic'}),original=new f.FakeNode({setFilter:'original'});basic.parent=f.views[0];original.parent=f.views[1];
  f.emit('click',basic);assert.deepEqual(f.views.map(v=>v.hidden),[true,false,true]);
  f.emit('click',original);assert.deepEqual(f.views.map(v=>v.hidden),[true,true,false]);
});
test('offline gallery is globally mana-sorted and combines set, class, rarity and search filters',()=>{
  const range=gallery.slice(gallery.indexOf('<main'),gallery.indexOf('</main>'));
  const cards=[...range.matchAll(/data-gallery-cost="([^"]+)" data-gallery-set="([^"]+)" data-gallery-class="([^"]+)" data-gallery-rarity="([^"]+)" data-gallery-search="([^"]+)"/g)].map(m=>({dataset:{galleryCost:Number(m[1]),gallerySet:m[2],galleryClass:m[3],galleryRarity:m[4],gallerySearch:m[5]},hidden:false}));
  assert.equal(cards.length,443);
  assert.deepEqual(cards.map(c=>c.dataset.galleryCost),cards.map(c=>c.dataset.galleryCost).sort((a,b)=>a-b));
  const groups=[...new Set(cards.map(c=>c.dataset.galleryCost))].map(cost=>({hidden:false,querySelectorAll:()=>cards.filter(c=>c.dataset.galleryCost===cost),querySelector:()=>({textContent:''})}));
  const count={textContent:''};
  const control=(value:string)=>({value,listeners:{} as Record<string,()=>void>,addEventListener(e:string,fn:()=>void){this.listeners[e]=fn;}});
  const search=control(''),set=control('all'),scope=control('all'),rarity=control('all'),reset=control('');
  const elements:Record<string,unknown>={'gallery-search':search,'gallery-set':set,'gallery-class':scope,'gallery-rarity':rarity,'gallery-reset':reset,'gallery-count':count};
  const document={getElementById:(id:string)=>elements[id],querySelectorAll:()=>groups};
  const filter=[...gallery.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];assert.ok(filter?.includes('gallery-rarity'));
  runInNewContext(filter!,{document});
  assert.equal(count.textContent,'443종 표시');
  set.value='basic';set.listeners.change();assert.equal(count.textContent,'133종 표시');assert.ok(cards.filter(c=>!c.hidden).every(c=>c.dataset.gallerySet==='basic'));
  set.value='original';set.listeners.change();assert.equal(count.textContent,'249종 표시');
  rarity.value='epic';rarity.listeners.change();assert.equal(count.textContent,'38종 표시');
  scope.value='mage';scope.listeners.change();assert.equal(count.textContent,'3종 표시');
  search.value='pyroblast';search.listeners.input();assert.equal(count.textContent,'1종 표시');
  search.value='not-a-card-name';search.listeners.input();assert.equal(count.textContent,'0종 표시');assert.ok(groups.every(g=>g.hidden));
  reset.listeners.click();assert.equal(count.textContent,'443종 표시');
  set.value='token';set.listeners.change();assert.equal(count.textContent,'61종 표시');
});
test('built game server delivers all 427 WebP illustrations with image MIME and same-origin policy',async()=>{
  const files=readdirSync('dist/client/assets').filter(f=>f.endsWith('.webp'));assert.equal(files.length,PAINTED_ASSETS.length);
  const {http,io}=createDuelServer(loadCatalog());http.listen(0,'127.0.0.1');await once(http,'listening');
  const address=http.address();assert.ok(address&&typeof address==='object');
  try{
    for(const file of files){const response:Response=await fetch(`http://127.0.0.1:${address.port}/assets/${file}`);assert.equal(response.status,200,file);assert.equal(response.headers.get('content-type'),'image/webp');assert.match(response.headers.get('content-security-policy')??'',/img-src 'self';/);const b=Buffer.from(await response.arrayBuffer());assert.equal(b.toString('ascii',8,12),'WEBP');}
  }finally{await io.close();}
});
