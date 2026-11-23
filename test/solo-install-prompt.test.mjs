import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../apps/client/solo-app/register.js',import.meta.url),'utf8');
function createUI({standalone=false,ios=false}={}){
  const events=new Map();
  const element=()=>({hidden:true,textContent:'',events:new Map(),addEventListener(type,handler){this.events.set(type,handler);}});
  const els=Object.fromEntries(['solo-app-banner','solo-app-status','solo-app-install','solo-app-install-help','solo-app-dismiss'].map(key=>[key,element()]));
  const window={isSecureContext:true,matchMedia:()=>({matches:standalone}),addEventListener:(type,fn)=>events.set(type,fn)};
  const navigator={standalone:false,userAgent:ios?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)':'Chrome/122.0'};
  runInNewContext(source,{document:{getElementById:key=>els[key]??null},navigator,window});
  return {els,events,fire:(type,event)=>events.get(type)?.(event),click:id=>els[id].events.get('click')?.()};
}
test('supported browser offers native PWA install and handles accept and installed',async()=>{
  const ui=createUI();let prevented=0,prompted=0;
  assert.equal(ui.els['solo-app-install-help'].hidden,false);
  ui.fire('beforeinstallprompt',{preventDefault(){prevented++;},async prompt(){prompted++;},userChoice:Promise.resolve({outcome:'accepted'})});
  assert.equal(prevented,1);assert.equal(ui.els['solo-app-install'].hidden,false);
  assert.equal(ui.els['solo-app-banner'].hidden,false);
  await ui.click('solo-app-install');
  assert.equal(prompted,1);assert.equal(ui.els['solo-app-install'].hidden,true);
  assert.match(ui.els['solo-app-status'].textContent,/설치 요청 완료/);
  ui.fire('appinstalled');
  assert.equal(ui.els['solo-app-install-help'].hidden,true);
  assert.match(ui.els['solo-app-status'].textContent,/홈 화면에 설치됨/);
});
test('iPhone provides manual Safari steps without pretending a native prompt exists',()=>{
  const ui=createUI({ios:true});assert.equal(ui.els['solo-app-install'].hidden,true);
  ui.click('solo-app-install-help');assert.match(ui.els['solo-app-status'].textContent,/Safari 공유 메뉴/);
  assert.match(ui.els['solo-app-status'].textContent,/홈 화면에 추가/);
});
test('already installed app never advertises installing again',()=>{
  const ui=createUI({standalone:true});
  assert.equal(ui.els['solo-app-install-help'].hidden,true);
  assert.equal(ui.events.has('beforeinstallprompt'),false);
});
