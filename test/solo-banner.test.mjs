import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {loadSoloRelease} from '../apps/cli/serve-solo-app.mjs';

const root=resolve(import.meta.dirname,'..');
const registration=readFileSync(resolve(root,'apps/client/solo-app/register.js'),'utf8');

test('PWA shell is an overlay: install notices cannot make the 100dvh landscape canvas scroll',()=>{
  const destination=mkdtempSync(join(tmpdir(),'card-duel-banner-'));
  try{
    execFileSync(process.execPath,['apps/client/test/build-solo-app.mjs'],{cwd:root,env:{...process.env,CARD_DUEL_SOLO_APP_DIST_DIR:destination}});
    const installed=loadSoloRelease(destination),html=readFileSync(join(destination,'index.html'),'utf8');
    assert.ok(installed.id,'new shell has content-verified install assets');
    assert.match(html,/<style id="solo-app-shell-style">#solo-app-banner\{position:fixed;/);
    assert.match(html,/top:calc\(env\(safe-area-inset-top,0px\) \+ 6px\)/);
    assert.match(html,/right:calc\(env\(safe-area-inset-right,0px\) \+ 6px\)/);
    assert.match(html,/#solo-app-banner\[hidden\]\{display:none!important\}/);
    assert.match(html,/#solo-app-banner button\{min-height:44px;min-width:44px/);
    assert.match(html,/id="solo-app-dismiss" type="button" aria-label="상태 알림 닫기"/);
    assert.match(html,/role="region" aria-label="오프라인 설치와 업데이트 상태"/);
    assert.equal(JSON.parse(readFileSync(join(destination,'manifest.webmanifest'),'utf8')).orientation,'landscape');
    assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"\/>/,'installed game uses notch-safe full-screen viewport');
    assert.equal((html.match(/viewport-fit=cover/g)??[]).length,1,'viewport-fit must not be duplicated');
  }finally{rmSync(destination,{recursive:true,force:true});}
});

test('the install status can be dismissed without disabling the game in an unsupported browser',()=>{
  const banner={hidden:true},status={textContent:''};let dismiss;
  const dismissButton={addEventListener:(name,callback)=>{if(name==='click')dismiss=callback;}};
  const elements={'solo-app-banner':banner,'solo-app-status':status,'solo-app-dismiss':dismissButton};
  runInNewContext(registration,{document:{getElementById:name=>elements[name]??null},navigator:{},window:{isSecureContext:false}});
  assert.equal(banner.hidden,false,'an unsupported browser initially explains limitations');
  assert.match(status.textContent,/오프라인 설치 미지원/);
  dismiss();assert.equal(banner.hidden,true);
});
