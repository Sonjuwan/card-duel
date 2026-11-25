import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';

test('phone/tablet combat uses entire available height instead of three redundant header rows',{timeout:120000},async t=>{
  const server=createSoloAppServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const addr=server.address();assert.ok(addr&&typeof addr==='object');
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  mkdirSync('ui-evidence',{recursive:true});
  for(const [label,width,height,isMobile] of [
    ['phone-844',844,390,true],
    ['phone-780',780,360,true],
    ['tablet-1024',1024,768,true],
    ['desktop-1280',1280,720,false],
  ]){
    const context=await browser.newContext({viewport:{width,height},isMobile,hasTouch:isMobile,deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',err=>errors.push(err.message));
    await page.goto('http://127.0.0.1:'+addr.port+'/');
    await page.getByRole('button',{name:'대전',exact:true}).click();
    await page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기'}).click();
    await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).click();
    await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();
    await page.getByRole('button',{name:/^확정 \(\d+장 교체\)$/}).click();
    await page.locator('.battle.duel-screen.phase-playing').waitFor({timeout:20000});
    const result=await page.evaluate(()=>{
      const rect=selector=>document.querySelector(selector)?.getBoundingClientRect();
      const style=selector=>getComputedStyle(document.querySelector(selector));
      const base='.game-main>.screen-content>.duel-screen.phase-playing';
      const title=base+'>.duel-title',message=base+'>.arena-message';
      const arena=rect(base+'>.battle-arena'),main=rect('.game-main'),button=rect('.duel-actions>button:last-child'),turn=rect('.end-turn');
      return {
        viewportWidth:innerWidth,viewportHeight:innerHeight,
        documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,
        headerDisplay:style('.game-main>.app-header').display,
        titlePosition:style(title).position,
        messagePosition:style(message).position,
        arenaTop:arena?.top,arenaHeight:arena?.height,mainTop:main?.top,mainHeight:main?.height,
        leaveTouch:button?.height??0,endTurnTouch:turn?.height??0,
        statusVisible:style(message+'>span:nth-child(2)').clipPath,
      };
    });
    assert.equal(result.headerDisplay,'none',label+' hides brand/header');
    assert.equal(result.titlePosition,'absolute',label+' title floating');
    assert.equal(result.messagePosition,'absolute',label+' hint floating');
    assert.ok(result.arenaHeight>=result.viewportHeight*.79,label+' battle should receive most viewport '+JSON.stringify(result));
    assert.ok(result.arenaTop<=result.viewportHeight*.09,label+' no three bars above the board '+JSON.stringify(result));
    assert.ok(result.leaveTouch>=36,label+' exit accessible');
    assert.ok(result.endTurnTouch>=36,label+' end turn accessible');
    assert.ok(result.documentWidth<=result.viewportWidth+2,label+' no horizontal page scroll');
    assert.ok(result.documentHeight<=result.viewportHeight+2,label+' no vertical page scroll');
    await page.screenshot({path:'ui-evidence/'+label+'-immersive-battle.png',fullPage:false});
    assert.deepEqual(errors,[],label+' no browser exceptions');
    await context.close();
  }
});
