import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';
import {chooseBasicDeck} from './deck-selection-browser.ts';

test('desktop and mobile battle settings share fullscreen without changing the live duel',{timeout:55000},async t=>{
  const server=createSoloAppServer(process.env.RUNEHALL_BATTLE_APP_DIR||undefined);
  server.prependListener('request',r=>{if(r.url.startsWith('/ui-preview/'))r.url=r.url.slice('/ui-preview'.length);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  mkdirSync('ui-evidence',{recursive:true});
  for(const device of [{width:1440,height:900,touch:false},{width:844,height:390,touch:true}]){
    const page=await browser.newPage({viewport:{width:device.width,height:device.height},hasTouch:device.touch,isMobile:device.touch,reducedMotion:'reduce'});
    const url='http://127.0.0.1:'+server.address().port+'/ui-preview/';
    await page.goto(url);
    await page.getByRole('button',{name:'대전',exact:true}).click();
    await chooseBasicDeck(page,'전사');
    await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).click();
    await page.locator('.mulligan-confirm').click();
    await page.locator('.end-turn:enabled').waitFor();
    const snapshot=()=>page.evaluate(()=>({
      hands:[...document.querySelectorAll('.hand-card-slot .battle-card')].map(e=>e.dataset.actionSource),
      mana:[...document.querySelectorAll('.battle-mana .mana-number')].map(e=>e.textContent),
      board:[...document.querySelectorAll('.arena-board,.hero-portrait')].map(e=>e.getAttribute('aria-label')),
      turn:document.querySelector('.turn-control>small').textContent,
      log:[...document.querySelectorAll('.impact-rail .impact-icon')].map(e=>e.getAttribute('aria-label')),
    }));
    const before=await snapshot();
    const open=page.getByRole('button',{name:'전투 설정'});
    const settings=page.getByRole('dialog',{name:'설정',exact:true});
    const continueGame=settings.getByRole('button',{name:'게임 계속하기'});
    await open.click();
    await settings.getByRole('button',{name:device.touch?'가로 전체화면':'전체화면',exact:true}).click();
    await page.waitForFunction(()=>document.fullscreenElement===document.documentElement);
    assert.deepEqual(await snapshot(),before);
    await page.screenshot({path:'ui-evidence/battle-fullscreen-'+device.width+'.png'});
    if(device.touch){
      await continueGame.click();
      await page.setViewportSize({width:780,height:360});
      await page.screenshot({path:'ui-evidence/battle-fullscreen-arena.png'});
      const stage=await page.locator('.battle-arena').boundingBox();
      assert.ok(stage.width<=780&&stage.height<=360);
      const rows=await page.locator('.arena-field>:is(.hero-zone,.arena-board)').evaluateAll(nodes=>nodes.map(e=>e.getBoundingClientRect().height));
      assert.equal(rows.length,4);
      assert.ok(Math.max(...rows)-Math.min(...rows)<2,JSON.stringify(rows));
      assert.deepEqual(await snapshot(),before);
      await page.evaluate(()=>document.exitFullscreen());
      await page.waitForFunction(()=>!document.fullscreenElement);
      await page.evaluate(()=>{document.documentElement.requestFullscreen=()=>Promise.reject(new Error('Unavailable'));});
      await open.click();
      await settings.getByRole('button',{name:'가로 전체화면',exact:true}).click();
      await settings.getByText(/전체화면이 제한|자동 화면 회전이 제한/).waitFor();
    }else{
      await settings.getByRole('button',{name:'전체화면 종료',exact:true}).click();
      await page.waitForFunction(()=>!document.fullscreenElement);
    }
    await continueGame.click();
    assert.deepEqual(await snapshot(),before);
    await page.close();
  }
});
