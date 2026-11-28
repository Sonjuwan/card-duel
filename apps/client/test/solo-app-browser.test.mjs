import {openLegacyPlayOptions} from './deck-selection-browser.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';

test('installed landscape solo app caches the game and resumes a ranked checkpoint without network',{timeout:90000},async t=>{
  const server=createSoloAppServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>{server.close(()=>resolve());}));
  const address=server.address();assert.ok(address&&typeof address==='object');
  const url=`http://127.0.0.1:${address.port}/`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  try{
    const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const openRecords=async(fresh=false)=>{
      const home=page.getByRole('button',{name:'대전',exact:true});
      if(fresh)await home.waitFor();
      if(await home.isVisible())await openLegacyPlayOptions(page);
      await page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기'}).click();
    };
    await page.goto(url);await page.getByRole('button',{name:'대전',exact:true}).waitFor();await openRecords();await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>({
      module:document.querySelector('script[type="module"][src="game.js"]')!==null,
      sheet:document.querySelector('link[rel="stylesheet"][href="game.css"]')?.sheet!==null,
      artRules:[...document.styleSheets].some(sheet=>sheet.href?.endsWith('/game.css')&&sheet.cssRules.length>0),
      assetFailed:window.__cardDuelAssetFailed===true,
    })),{module:true,sheet:true,artRules:true,assetFailed:false},'all offline-split game resources load in a real browser');
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).click();
    await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();await page.getByRole('button',{name:'전투 설정'}).click();await page.getByText('자동 저장됨',{exact:true}).waitFor();
    await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'대전',exact:true}).waitFor();await openRecords();
    assert.equal(await page.evaluate(()=>document.querySelector('link[href="game.css"]')?.sheet!==null),true,'card art stylesheet survives offline reload');
    await page.getByText('진행 중인 랭크 대전',{exact:true}).waitFor();
    // Switch without ending or removing the existing ranked match, then return.
    await page.getByRole('button',{name:'새로 시작 · 슬롯 2',exact:true}).click();
    await openRecords(true);
    await page.getByText('기기 AI 대전은 자동으로 저장됩니다.').waitFor();
    await page.getByText('저장 슬롯 2 · XP 0',{exact:true}).waitFor();
    assert.equal(await page.getByText('진행 중인 랭크 대전',{exact:true}).count(),0);
    await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).click();
    await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();
    await page.getByRole('button',{name:'전투 설정'}).click();
    await page.getByRole('button',{name:'저장 후 나가기'}).click();
    await openRecords();
    await page.getByText('진행 중인 랭크 대전',{exact:true}).waitFor();
    const codes=await page.evaluate(async()=>Promise.all(['card-duel-solo-saves-v1','card-duel-solo-saves-v1-slot-2'].map(name=>new Promise((resolve,reject)=>{const request=indexedDB.open(name,2);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('matches','readonly'),all=tx.objectStore('matches').getAll();tx.oncomplete=()=>{db.close();const snapshot=all.result[0]?.snapshot;if(name.endsWith('slot-2')&&snapshot)localStorage.setItem('card-duel-slot-2:card-duel-saved-decks',JSON.stringify([{name:'백업 시험 덱',deck:snapshot.input.deck}]));resolve(snapshot?.summary.code);};tx.onerror=()=>reject(tx.error);};}))));assert.ok(codes[0]&&codes[1]&&codes[0]!==codes[1]);
    assert.equal(await page.getByRole('button',{name:/백업|복원/}).count(),0);
    assert.equal(await page.locator('input[type=file]').count(),0);
    await page.getByRole('button',{name:'슬롯 3',exact:true}).click();await openRecords(true);
    await page.getByText('저장 슬롯 3 · XP 0',{exact:true}).waitFor();
    assert.equal(await page.getByText('진행 중인 랭크 대전',{exact:true}).count(),0);
    assert.deepEqual(await page.evaluate(()=>{
      const get=slot=>JSON.parse(localStorage.getItem(`card-duel-slot-${slot}:card-duel-saved-decks`)??'[]').map(deck=>deck.name);
      return [get(2),get(3)];
    }),[['백업 시험 덱'],[]]);
    await page.getByRole('button',{name:'슬롯 2',exact:true}).click();await openRecords(true);await page.getByText('진행 중인 랭크 대전',{exact:true}).waitFor();
    await page.reload();await page.getByRole('button',{name:'대전',exact:true}).waitFor();await openRecords();await page.getByText('저장 슬롯 2 · XP 0',{exact:true}).waitFor();
    // Simulate an older card-hash ranked checkpoint in another slot. Only
    // this disposable browser context is changed; no real card snapshot is changed.
    await page.evaluate(async()=>{
      const open=name=>new Promise((resolve,reject)=>{const request=indexedDB.open(name,2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      const source=await open('card-duel-solo-saves-v1'),target=await open('card-duel-solo-saves-v1-slot-3');
      try{const entry=await new Promise((resolve,reject)=>{const tx=source.transaction('matches','readonly'),all=tx.objectStore('matches').getAll();tx.oncomplete=()=>resolve(all.result[0]);tx.onerror=()=>reject(tx.error);});
        const oldHash='b'.repeat(64),old={...entry,hash:oldHash,snapshot:{...entry.snapshot,catalogHash:oldHash,summary:{...entry.snapshot.summary,catalogHash:oldHash},input:{...entry.snapshot.input,catalogHash:oldHash}}};
        await new Promise((resolve,reject)=>{const tx=target.transaction('matches','readwrite');tx.objectStore('matches').put(old);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
      }finally{source.close();target.close();}
    });
    await page.getByRole('button',{name:'슬롯 3',exact:true}).click();await openRecords(true);await page.getByText(/이전 카드 버전의 진행 중인 랭크 경기가 있습니다/).waitFor();assert.equal(await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).isDisabled(),true);
    await page.getByRole('button',{name:'슬롯 1',exact:true}).click();await openRecords(true);
    await page.getByText('진행 중인 랭크 대전',{exact:true}).waitFor();
    await page.getByRole('dialog',{name:'슬롯 · 성장 · 저장 경기'}).getByRole('button',{name:'이어하기',exact:true}).click();await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
