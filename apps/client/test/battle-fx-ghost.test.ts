import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareFxGhost} from '../src/battle-fx-ghost.ts';

type Attrs=Record<string,string>;
function fake(attributes:Attrs={}){
  const element={
    attributes:{...attributes},
    setAttribute(key:string,value:string){this.attributes[key]=value;},
    removeAttribute(key:string){delete this.attributes[key];},
    hasAttribute(key:string){return key in this.attributes;},
    getAttribute(key:string){return this.attributes[key]??null;},
    getAttributeNames(){return Object.keys(this.attributes);},
    matches(query:string){return (query.includes('[tabindex]')&&this.hasAttribute('tabindex'))||(query.includes('a[href]')&&this.hasAttribute('href'))||(query.includes('button')&&this.hasAttribute('data-test-button'))||(query.includes('[contenteditable]')&&this.hasAttribute('contenteditable'));},
  };
  return element;
}
test('visual combat ghosts hide interactions, targets and duplicate identifiers without erasing original SVG art references',()=>{
  const link=fake({id:'action-anchor',href:'/battle',tabindex:'0'});
  const button=fake({id:'action',tabindex:'0','data-test-button':'true','data-preview-minion':'stale-target','data-action-source':'true'});
  const editable=fake({contenteditable:'true'});
  const svg=fake({id:'fx-gradient'});
  const drawn=fake({fill:'url(#fx-gradient)',style:'stroke:url("#fx-gradient")',mask:'url(#mask-id)'});
  const use=fake({href:'#fx-gradient','xlink:href':'#fx-gradient'});
  const masked=fake({id:'mask-id','aria-labelledby':'action fx-gradient'});
  const ghost={...fake({id:'card',tabindex:'0'}),querySelectorAll(query:string){assert.equal(query,'*');return [link,button,editable,svg,drawn,use,masked];}};
  prepareFxGhost(ghost as unknown as HTMLElement);
  assert.equal(ghost.attributes['aria-hidden'],'true');assert.equal(ghost.attributes.inert,'');assert.equal(ghost.attributes.tabindex,'-1');
  assert.match(ghost.attributes.id,/^fx-ghost-\d+-card$/);
  for(const node of [link,button,svg,masked])assert.match(node.attributes.id,/^fx-ghost-\d+-/);
  assert.equal(drawn.attributes.fill,`url(#${svg.attributes.id})`);
  assert.equal(drawn.attributes.style,`stroke:url("#${svg.attributes.id}")`);
  assert.equal(drawn.attributes.mask,`url(#${masked.attributes.id})`);
  assert.equal(use.attributes.href,`#${svg.attributes.id}`);assert.equal(use.attributes['xlink:href'],`#${svg.attributes.id}`);
  assert.equal(masked.attributes['aria-labelledby'],`${button.attributes.id} ${svg.attributes.id}`);
  for(const element of [link,button,editable])assert.equal(element.attributes.tabindex,'-1');
  assert.equal(editable.attributes.contenteditable,'false');
  assert.equal('data-preview-minion' in button.attributes,false);assert.equal('data-action-source' in button.attributes,false);
});
test('separate ghost snapshots receive unique ids without leaking reference mutations to the source',()=>{
  const make=()=>{const child=fake({id:'icon'});return {...fake({id:'card',style:'filter:url(#icon)'}),querySelectorAll(){return [child];},child};};
  const one=make(),two=make();prepareFxGhost(one as unknown as HTMLElement);prepareFxGhost(two as unknown as HTMLElement);
  assert.notEqual(one.attributes.id,two.attributes.id);
  assert.notEqual(one.child.attributes.id,two.child.attributes.id);
  assert.equal(one.attributes.style,`filter:url(#${one.child.attributes.id})`);
  assert.equal(two.attributes.style,`filter:url(#${two.child.attributes.id})`);
});
test('attack and departure ghosts use the same non-interactive visual guard',()=>{
 const battle=readFileSync(new URL('../src/battle-fx.tsx',import.meta.url),'utf8');
 assert.equal((battle.match(/prepareFxGhost\(ghost\)/g)??[]).length,2);
});
