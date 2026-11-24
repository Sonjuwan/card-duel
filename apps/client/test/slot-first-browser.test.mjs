import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createCatalog} from '../../../packages/engine/src/index.ts';
import {recommendedOwnedDeck} from '../../../packages/progression.ts';
import {offlineGrowth,readOfflineGrowth} from '../src/offline-growth.ts';
import {loadSoloRelease} from '../../cli/serve-solo-app.mjs';

test('UI preview chooses a save slot first, then uses only that slot cards, decks, ranked checkpoint and progress',{timeout:120000},async t=>{
  const {files}=loadSoloRelease();
  const mime={'index.html':'text/html','game.js':'text/javascript','game.css':'text/css','register.js':'text/javascript','sw.js':'text/javascript','manifest.webmanifest':'application/manifest+json','icon-192.png':'image/png','icon-512.png':'image/png'};
  const server=createServer((req,res)=>{
    const url=(req.url??'/').split('?')[0];
    const path=url==='/ui-preview/'?'index.html':url.startsWith('/ui-preview/')?url.slice('/ui-preview/'.length):'index.html';
    if(!Object.hasOwn(mime,path)||!files.has(path)){res.writeHead(404).end();return;}
    const data=files.get(path);
    res.writeHead(200,{'Content-Type':mime[path]});
    res.end(req.method==='HEAD'?undefined:data);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const a=server.address();assert.ok(a&&typeof a==='object');
  const cards=JSON.parse(readFileSync(new URL('../../../data/cards/v0.19.0.json',import.meta.url),'utf8'));
  const catalog=createCatalog(cards),growth=offlineGrowth(catalog),profile=readOfflineGrowth(undefined,growth).profile;
  const entries=[
    {name:'슬롯1 마법사',deck:recommendedOwnedDeck(catalog,growth,'mage',profile,117)},
    {name:'슬롯2 전사',deck:recommendedOwnedDeck(catalog,growth,'warrior',profile,117)},
  ];
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  await context.addInitScript(({entries})=>{
    localStorage.setItem('card-duel-ui-preview-slot-1:card-duel-saved-decks',JSON.stringify([entries[0]]));
    localStorage.setItem('card-duel-ui-preview-slot-2:card-duel-saved-decks',JSON.stringify([entries[1]]));
  },{entries});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',err=>errors.push(err.message));page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:'+a.port+'/ui-preview/');
  await page.getByRole('heading',{name:'저장 슬롯을 선택하세요'}).waitFor();
  assert.equal(await page.locator('.slot-entry-card').count(),3);
  assert.equal(await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).count(),0,'cannot play before choosing slot');
  await page.getByRole('button',{name:'슬롯 2 선택',exact:true}).click();
  const picker=page.getByLabel('선택한 슬롯의 저장 덱');
  await picker.waitFor();
  assert.ok((await picker.locator('option').allTextContents()).some(x=>x.includes(entries[1].name)),'slot 2 owns its saved deck');
  assert.ok(!(await picker.locator('option').allTextContents()).some(x=>x.includes(entries[0].name)),'slot 1 deck never leaks into slot 2');
  await picker.selectOption('0');
  await page.getByRole('button',{name:'이 덱으로 랭크 대전 시작'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'이 덱으로 랭크 대전 시작'}).isEnabled(),true,'slot-owned starter deck must be playable');
  await page.getByRole('button',{name:'이 덱으로 랭크 대전 시작'}).click();
  await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();
  const matchCounts=await page.evaluate(async()=>{
    const count=async name=>{
      const req=indexedDB.open(name,2);
      const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
      const n=await new Promise((resolve,reject)=>{const tx=db.transaction('matches','readonly'),all=tx.objectStore('matches').getAll();tx.oncomplete=()=>resolve(all.result.length);tx.onerror=()=>reject(tx.error)});
      db.close();return n;
    };
    return [await count('card-duel-solo-saves-v1-ui-preview'),await count('card-duel-solo-saves-v1-slot-2-ui-preview')];
  });
  assert.deepEqual(matchCounts,[0,1],'a slot 2 match cannot be written into slot 1');
  await page.getByRole('button',{name:'나가기',exact:true}).click();
  await page.getByRole('button',{name:'슬롯 2 변경'}).click();
  await page.getByRole('heading',{name:'저장 슬롯을 선택하세요'}).waitFor();
  await page.getByRole('button',{name:'슬롯 1 선택'}).click();
  const other=page.getByLabel('선택한 슬롯의 저장 덱');
  await other.waitFor();
  assert.ok((await other.locator('option').allTextContents()).some(x=>x.includes(entries[0].name)),'slot 1 reads its own deck');
  assert.ok(!(await other.locator('option').allTextContents()).some(x=>x.includes(entries[1].name)),'slot 2 deck not shown in slot 1');
  assert.deepEqual(errors,[]);
  await context.close();
});