import {openLegacyPlayOptions} from './deck-selection-browser.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';

// Runs against the COMPILED candidate after the Node 24 build, not against
// source CSS, a static mockup or the old v0.197 fallback. This is a release
// blocker for landscape-first installed play.
test('landscape mobile PWA stays within one screen from lobby through first turn',{timeout:120000},async t=>{
  const server=createSoloAppServer();
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const addr=server.address();assert.ok(addr&&typeof addr==='object');
  const browser=await chromium.launch({
    headless:true,
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined
  });
  t.after(()=>browser.close());
  const context=await browser.newContext({
    viewport:{width:844,height:390},isMobile:true,hasTouch:true,
    deviceScaleFactor:2
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${addr.port}/`);
  await openLegacyPlayOptions(page);
  await page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기'}).click();
  await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).waitFor();

  async function checkCanvas(label){
    const info=await page.evaluate(()=>({
      width:innerWidth,height:innerHeight,
      documentWidth:document.documentElement.scrollWidth,
      documentHeight:document.documentElement.scrollHeight,
      scrollX:window.scrollX,scrollY:window.scrollY,
      portrait:matchMedia('(orientation:portrait)').matches
    }));
    assert.equal(info.portrait,false,`${label}: viewport must be landscape`);
    assert.ok(info.documentWidth<=info.width+2,`${label}: horizontal page scroll: ${JSON.stringify(info)}`);
    assert.ok(info.documentHeight<=info.height+2,`${label}: vertical page scroll: ${JSON.stringify(info)}`);
    assert.equal(info.scrollY,0,`${label}: game cannot scroll the entire document`);
  }
  await checkCanvas('lobby');
  await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).click();
  await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();
  await checkCanvas('mulligan');

  const confirm=page.getByRole('button',{name:/^확정 \(\d+장 교체\)$/});
  await confirm.click();
  await page.locator('.battle.phase-playing .battle-arena').waitFor();
  await checkCanvas('first playable turn');

  const align=await page.evaluate(()=>{
    const enemy=document.querySelector('.enemy-hero-zone .hero-portrait');
    const self=document.querySelector('.self-hero-zone .hero-portrait');
    if(!enemy||!self)return null;
    const x=element=>{
      const rect=element.getBoundingClientRect();
      return rect.left+rect.width/2;
    };
    return {enemyX:x(enemy),selfX:x(self)};
  });
  assert.ok(align,'both heroes must remain visible');
  assert.ok(Math.abs(align.enemyX-align.selfX)<30,`heroes are not vertically aligned: ${JSON.stringify(align)}`);
  await page.getByRole('button',{name:'턴 종료'}).waitFor();
  for(const [width,height] of [[667,375],[1024,600]]){
    await page.setViewportSize({width,height});
    await checkCanvas(`${width}x${height} battlefield`);
  }
  assert.deepEqual(errors,[],'no unhandled browser JavaScript errors');
});
