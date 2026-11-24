import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';

test('preview book, audio settings and saved match work across desktop, tablet and phone',{timeout:90000},async t=>{
  const server=createSoloAppServer();
  server.prependListener('request',req=>{
    if(req.url.startsWith('/ui-preview/'))req.url=req.url.slice('/ui-preview'.length);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  mkdirSync('ui-evidence',{recursive:true});
  for(const [label,width,height,hasTouch] of [['pc',1920,1080,false],['tablet',1024,768,true],['phone',844,390,true]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch,isMobile:hasTouch});
    await context.addInitScript(()=>{
      window.decodedTracks=0;
      const decode=AudioContext.prototype.decodeAudioData;
      AudioContext.prototype.decodeAudioData=function(...args){
        const pending=decode.apply(this,args);
        pending.then(buffer=>{if(buffer.duration>8)window.decodedTracks++;},()=>{});
        return pending;
      };
    });
    const page=await context.newPage();
    page.setDefaultTimeout(6500);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const url='http://127.0.0.1:'+server.address().port+'/ui-preview/';
    await page.goto(url);
    await page.getByRole('button',{name:'슬롯 1 선택',exact:true}).click();
    await page.getByRole('button',{name:'설정',exact:true}).click();
    const settings=page.getByRole('dialog',{name:'설정',exact:true});
    const music=settings.getByRole('slider',{name:'배경음악 음량'});
    assert.equal(await music.inputValue(),'40');
    await music.fill('27');
    await page.waitForFunction(()=>window.decodedTracks>0);
    await settings.getByRole('button',{name:'전체 음소거'}).click();
    assert.equal(await music.inputValue(),'27');
    await settings.getByRole('button',{name:'기본 설정으로 복원'}).click();
    assert.equal(await music.inputValue(),'40');
    await settings.getByRole('button',{name:'닫기',exact:true}).click();
    await page.getByRole('button',{name:'카드 도감',exact:true}).click();
    const pageCards=page.locator('.collection-leaf .battle-card');
    await pageCards.first().waitFor();
    assert.equal(await pageCards.count(),8,label);
    assert.deepEqual(await page.locator('.book-class-tabs button').allTextContents(),['전','주','도','성','냥','드','흑','마','사','공']);
    const size=await pageCards.first().boundingBox();
    assert.ok(Math.abs(size.width/size.height-1/1.55)<.04,JSON.stringify(size));
    await page.getByRole('button',{name:'주술사',exact:true}).click();
    assert.match(await page.locator('.book-page-status').textContent(),/주술사 1\//);
    await page.getByRole('button',{name:'이전 페이지',exact:true}).click();
    assert.match(await page.locator('.book-page-status').textContent(),/전사 \d+\//);
    await page.getByRole('button',{name:'카드 필터',exact:true}).click();
    await page.getByRole('button',{name:'10마나 이상',exact:true}).click();
    await page.getByRole('button',{name:'필터 초기화',exact:true}).click();
    await page.getByRole('dialog',{name:'카드 필터',exact:true}).getByRole('button',{name:'닫기',exact:true}).click();
    await page.screenshot({path:'ui-evidence/integrated-'+label+'-catalog.png'});
    await page.getByRole('button',{name:'메인으로'}).click();
    await page.getByRole('button',{name:'대전',exact:true}).click();
    await page.getByRole('button',{name:'전사',exact:true}).click();
    await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).click();
    await page.locator('.mulligan-cards .battle-card').first().waitFor();
    const selected=page.locator('.mulligan-cards .battle-card').first();
    await selected.click();assert.equal(await selected.getAttribute('aria-pressed'),'true');
    await selected.click();assert.equal(await selected.getAttribute('aria-pressed'),'false');
    await page.getByRole('button',{name:'전투 설정'}).click();
    await page.getByRole('button',{name:'저장 후 나가기'}).click();
    const resume=page.getByRole('button',{name:'이어서 플레이하기'});
    const restart=page.getByRole('button',{name:'새로운 게임 시작'});
    await resume.waitFor();
    const left=await resume.boundingBox(),right=await restart.boundingBox();
    assert.ok(left.x<right.x&&Math.abs(left.y-right.y)<4);
    page.once('dialog',dialog=>dialog.dismiss());
    await restart.click();
    await resume.click();
    await page.locator('.mulligan-cards .battle-card').first().waitFor();
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button',{name:'슬롯 1 선택',exact:true}).click();
    await page.getByRole('button',{name:'대전',exact:true}).click();
    await resume.click();
    await page.locator('.mulligan-cards .battle-card').first().waitFor();
    await page.locator('.mulligan-confirm').click();
    const hand=page.locator('.own-hand .hand-card-slot .battle-card').first();
    await hand.waitFor();
    await hand.focus();
    const {top,bottom}=await hand.evaluate(card=>({
      top:card.getBoundingClientRect().top,
      bottom:document.querySelector('.friendly-minions').getBoundingClientRect().bottom,
    }));
    assert.ok(top>=bottom-1,label+' hand preview should clear the friendly lane');
    assert.deepEqual(errors,[]);
    await context.close();
  }
});
