import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {loadSoloRelease} from '../../cli/serve-solo-app.mjs';

test('hosted UI preview keeps the root website saves intact after concede and restarting',{timeout:120000},async t=>{
  const {files}=loadSoloRelease();
  const mime={'index.html':'text/html; charset=utf-8','game.js':'text/javascript; charset=utf-8','game.css':'text/css; charset=utf-8','register.js':'text/javascript; charset=utf-8','sw.js':'text/javascript; charset=utf-8','manifest.webmanifest':'application/manifest+json','icon-192.png':'image/png','icon-512.png':'image/png'};
  const server=createServer((req,res)=>{
    const uri=(req.url??'/').split('?')[0];
    const path=uri==='/'||uri==='/ui-preview/'?'index.html':uri.startsWith('/ui-preview/')?uri.slice('/ui-preview/'.length):uri.slice(1);
    if(!Object.hasOwn(mime,path)||!files.has(path)){res.writeHead(404).end('Not found');return;}
    const body=files.get(path);
    res.writeHead(200,{'Content-Type':mime[path],'Content-Length':body.length});
    res.end(req.method==='HEAD'?undefined:body);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const address=server.address();assert.ok(address&&typeof address==='object');
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  const base='http://127.0.0.1:'+address.port;
  await page.goto(base+'/ui-preview/');
  await page.getByRole('heading',{name:'저장 슬롯을 선택하세요'}).waitFor();
  await page.evaluate(async()=>{
    // This existing root save is purposely left invalid: the preview must
    // NEVER consult or mutate a different release's original game data.
    localStorage.setItem('card-duel-saved-decks','LIVE-ORIGINAL-DO-NOT-TOUCH');
    const open=indexedDB.open('card-duel-solo-saves-v1',2);
    await new Promise((resolve,reject)=>{
      open.onupgradeneeded=()=>{
        if(!open.result.objectStoreNames.contains('matches'))open.result.createObjectStore('matches',{keyPath:'hash'});
        if(!open.result.objectStoreNames.contains('growth'))open.result.createObjectStore('growth');
      };
      open.onerror=()=>reject(open.error);
      open.onsuccess=()=>{
        const db=open.result,tx=db.transaction('matches','readwrite');
        tx.objectStore('matches').put({hash:'f'.repeat(64),owner:'old-site',snapshot:{marker:'PROTECT-OLD-MATCH'}});
        tx.onerror=()=>reject(tx.error);
        tx.oncomplete=()=>{db.close();resolve();};
      };
    });
  });
  await page.getByRole('button',{name:'슬롯 1 선택',exact:true}).click();
  await page.getByRole('button',{name:'대전',exact:true}).click();
  await page.getByRole('button',{name:'마법사',exact:true}).click();
  await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).click();
  await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();
  await page.getByRole('button',{name:/^확정 \(\d+장 교체\)$/}).click();
  await page.locator('.battle.phase-playing .battle-arena').waitFor();
  await page.getByRole('button',{name:'전투 설정'}).click();
  await page.getByRole('button',{name:'항복하기',exact:true}).click();
  await page.getByRole('dialog',{name:'대전 결과'}).waitFor({timeout:20000});
  await page.getByRole('button',{name:'대전 준비로 돌아가기'}).click();
  await page.getByRole('button',{name:'마법사',exact:true}).click();
  const start=page.getByRole('button',{name:'선택한 덱으로 대전 시작'});
  await start.waitFor();
  const diag=await page.evaluate(()=>({error:document.querySelector('.error')?.textContent??'',hashes:localStorage.getItem('card-duel-saved-decks'),databases:[]})); 
  assert.equal(await start.isEnabled(),true,'preview must allow a new ranked match: '+JSON.stringify(diag));
  await start.click();
  await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor({timeout:20000});
  // Saving is not a loss. Both resume and new-game choices must be available.
  await page.getByRole('button',{name:'전투 설정'}).click();
  await page.getByRole('button',{name:'저장 후 나가기'}).click();
  await page.getByRole('button',{name:'이어서 플레이하기'}).waitFor();
  await page.getByRole('button',{name:'이어서 플레이하기'}).click();
  await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();
  await page.getByRole('button',{name:'전투 설정'}).click();
  await page.getByRole('button',{name:'저장 후 나가기'}).click();
  await page.getByRole('button',{name:'새로운 게임 시작'}).click();
  await page.getByRole('button',{name:'마법사',exact:true}).click();
  const conceded=await page.evaluate(async()=>{
    const req=indexedDB.open('card-duel-solo-saves-v1-ui-preview',2);
    const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
    const result=await new Promise((resolve,reject)=>{const tx=db.transaction('matches','readonly'),all=tx.objectStore('matches').getAll();tx.oncomplete=()=>resolve(all.result.map(e=>({phase:e.snapshot.summary.phase,winner:e.snapshot.state.winner,reason:e.snapshot.state.reason})));tx.onerror=()=>reject(tx.error)});
    db.close();return result;
  });
  assert.ok(conceded.some(x=>x.phase==='finished'&&x.reason==='concede'&&x.winner===1),'starting a new game records the previous saved ranked match as defeat');
  await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).click();
  await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();
  await page.reload();
  await page.getByRole('button',{name:'슬롯 1 선택',exact:true}).click();
  await page.getByRole('button',{name:'대전',exact:true}).click();
  await page.getByRole('button',{name:'이어서 플레이하기'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'새로운 게임 시작'}).count(),1,'reopening a saved match offers both resume and new game');
  const verify=await page.evaluate(async()=>{
    const names=(await indexedDB.databases()).map(db=>db.name);
    const txRead=async()=>{
      const open=indexedDB.open('card-duel-solo-saves-v1',2);
      const db=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
      const value=await new Promise((resolve,reject)=>{const tx=db.transaction('matches','readonly'),get=tx.objectStore('matches').get('f'.repeat(64));get.onsuccess=()=>resolve(get.result?.snapshot?.marker);get.onerror=()=>reject(get.error);});
      db.close();return value;
    };
    return {names,marker:await txRead(),legacy:localStorage.getItem('card-duel-saved-decks')};
  });
  assert.equal(verify.marker,'PROTECT-OLD-MATCH','live DB bytes stay untouched');
  assert.equal(verify.legacy,'LIVE-ORIGINAL-DO-NOT-TOUCH','live localStorage stays untouched');
  assert.ok(verify.names.includes('card-duel-solo-saves-v1-ui-preview'),JSON.stringify(verify.names));
  assert.deepEqual(errors,[],'browser must not throw');
  await context.close();
});