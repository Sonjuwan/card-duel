import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';

test('real solo ranked concede -> result -> leave -> new ranked mulligan without storage reset',{timeout:120000},async t=>{
  const server=createSoloAppServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const addr=server.address();assert.ok(addr&&typeof addr==='object');
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  for(const [name,width,height] of [['desktop',1280,800],['phone',844,390]]){
    const ctx=await browser.newContext({viewport:{width,height},isMobile:name==='phone',hasTouch:name==='phone'});
    const page=await ctx.newPage();
    page.on('dialog',dialog=>dialog.accept());
    const runtimeErrors=[]; page.on('pageerror',e=>runtimeErrors.push(e.message));
    const url='http://127.0.0.1:'+addr.port+'/';
    await page.goto(url);
    await page.getByRole('button',{name:'대전',exact:true}).click();
    await page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기'}).click();
    await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).click();
    await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();
    await page.getByRole('button',{name:/^확정 \(\d+장 교체\)$/}).click();
    await page.locator('.battle.phase-playing .battle-arena').waitFor();
    // Player-mode battle surrender now lives in the centered gear settings.
    await page.locator('.compact-settings-trigger').click();
    await page.getByRole('button',{name:'항복하기'}).click();
    await page.getByRole('dialog',{name:'대전 결과'}).waitFor({timeout:20000});
    await page.getByRole('button',{name:'대전 준비로 돌아가기'}).click();
    await page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기'}).waitFor({timeout:20000});
    await page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기'}).click();
    const start=page.getByRole('button',{name:'솔로 랭크 대전 시작'});
    await start.waitFor({timeout:20000});
    const pre=await page.evaluate(()=>({error:document.querySelector('.error')?.textContent||'',btn:[...document.querySelectorAll('button')].filter(x=>x.textContent?.includes('솔로 랭크 대전 시작')).map(x=>({disabled:x.disabled,visible:getComputedStyle(x).display})),dialogCount:document.querySelectorAll('dialog[open]').length}));
    assert.equal(await start.isEnabled(),true, name+' can restart ranked: '+JSON.stringify(pre));
    await start.click();
    await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor({timeout:20000});
    assert.deepEqual(runtimeErrors,[],name+' browser JS errors');
    await ctx.close();
  }
});