import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {showOfflineBootFailure} from '../apps/client/src/offline-startup.ts';
import {readFileSync} from 'node:fs';
function fakeDom(){
  const nodes=[];const make=tag=>({tag,children:[],textContent:'',className:'',type:'',attributes:{},listeners:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,cb){this.listeners[k]=cb;},append(...children){this.children.push(...children);}});
  return {doc:{createElement:tag=>{const el=make(tag);nodes.push(el);return el;}},root:{children:[],replaceChildren(...els){this.children=els;}},nodes};
}
test('offline boot failure gives a visible retry without removing or reading persisted saves',()=>{
  const {doc,root,nodes}=fakeDom();let retries=0;
  showOfflineBootFailure(doc,root,()=>retries++);
  assert.equal(root.children[0].tag,'main');
  assert.equal(nodes.find(n=>n.tag==='section').attributes.role,'alert');
  assert.match(nodes.find(n=>n.tag==='p').textContent,/저장된 경기와 덱은 삭제하지 않았습니다/);
  nodes.find(n=>n.tag==='button').listeners.click();assert.equal(retries,1);
});
test('catalog validation failure in the real offline entrypoint is caught before React mounting',()=>{
  const source=readFileSync(new URL('../apps/client/src/offline-main.tsx',import.meta.url),'utf8');
  assert.match(source,/try\{[\s\S]*loadPublicCatalog\(__OFFLINE_CARDS__/);
  assert.match(source,/catch\{[\s\S]*showOfflineBootFailure\(document,host,\(\)=>window\.location\.reload\(\)\)/);
});
