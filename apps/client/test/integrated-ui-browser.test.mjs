import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';

async function previewBrowser(t){
  const server=createSoloAppServer();
  server.prependListener('request',req=>{
    if(req.url.startsWith('/ui-preview/'))req.url=req.url.slice('/ui-preview'.length);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  return {browser,url:'http://127.0.0.1:'+server.address().port+'/ui-preview/'};
}

test('preview book, audio settings and saved match work across desktop, tablet and phone',{timeout:90000},async t=>{
  const {browser,url}=await previewBrowser(t);
  mkdirSync('ui-evidence',{recursive:true});
  for(const [label,width,height,hasTouch] of [['pc',1920,1080,false],['tablet',1024,768,true],['phone',844,390,true]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch,isMobile:hasTouch});
    const page=await context.newPage();
    page.setDefaultTimeout(6500);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);
    await page.getByRole('button',{name:'슬롯 1 선택',exact:true}).click();
    await page.getByRole('button',{name:'설정',exact:true}).click();
    const settings=page.getByRole('dialog',{name:'설정',exact:true});
    const effects=settings.getByRole('slider',{name:'효과음 볼륨'});
    const mute=settings.getByRole('button',{name:'전체 음소거'});
    assert.equal(await settings.getByRole('slider',{name:'배경음악 음량'}).count(),0);
    assert.equal(await effects.inputValue(),'75');
    await effects.fill('27');
    await mute.click();
    assert.equal(await mute.getAttribute('aria-pressed'),'true');
    assert.equal(await effects.inputValue(),'27');
    await settings.getByRole('button',{name:'기본 설정으로 복원'}).click();
    assert.equal(await mute.getAttribute('aria-pressed'),'false');
    assert.equal(await effects.inputValue(),'75');
    await page.screenshot({path:'ui-evidence/audio-'+label+'.png'});
    await settings.getByRole('button',{name:'닫기',exact:true}).click();
    await page.getByRole('button',{name:/경험치 · 카드 획득/}).click();
    const reward=await page.locator('.road-stop .battle-card').first().boundingBox();
    assert.ok(reward&&Math.abs(reward.width/reward.height-1/1.55)<.025,label+' reward ratio '+JSON.stringify(reward));
    await page.getByRole('button',{name:'다음 보상 구간'}).click();
    await page.getByRole('button',{name:'이전 보상 구간'}).click();
    await page.screenshot({path:'ui-evidence/road-'+label+'.png'});
    await page.getByRole('button',{name:'메인으로'}).click();
    await page.getByRole('button',{name:/등급/}).click();
    await page.getByRole('img',{name:'브론즈 V',exact:true}).waitFor();
    await page.screenshot({path:'ui-evidence/rank-'+label+'.png'});
    await page.getByRole('button',{name:'메인으로'}).click();
    await page.getByRole('button',{name:'카드 도감',exact:true}).click();
    const settingsRect=await page.getByRole('button',{name:'설정',exact:true}).boundingBox();
    const homeRect=await page.getByRole('button',{name:'메인으로'}).boundingBox();
    assert.ok(settingsRect.x+settingsRect.width<width*.5&&homeRect.x>width*.5);
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
    await page.getByRole('button',{name:'10마나 이상',exact:true}).click();
    await page.getByRole('button',{name:'필터 초기화',exact:true}).click();
    assert.equal(await page.locator('.collection-inspector-sidebar').count(),0);
    const bookmarks=await page.locator('.book-class-tabs button').evaluateAll(tabs=>{
      const selected=tabs.find(tab=>tab.getAttribute('aria-pressed')==='true');
      const other=tabs.find(tab=>tab!==selected);
      return {width:selected.getBoundingClientRect().width/other.getBoundingClientRect().width,
        left:selected.getBoundingClientRect().left};
    });
    assert.ok(bookmarks.width>=1.39&&bookmarks.width<=1.51&&bookmarks.left>=0,label+' '+JSON.stringify(bookmarks));
    const geometry=await page.locator('.collection-book').evaluate(book=>({
      scrolling:book.scrollHeight>book.clientHeight+2,
      edge:book.previousElementSibling.getBoundingClientRect().height,
      book:book.getBoundingClientRect().height,
      top:Math.min(...Array.from(book.querySelectorAll('.battle-card'),card=>card.getBoundingClientRect().top)),
      tab:document.querySelector('.book-class-tabs button[aria-pressed=true]').getBoundingClientRect().top,
    }));
    assert.equal(geometry.scrolling,false);
    assert.ok(geometry.edge>=geometry.book);
    assert.ok(geometry.top>=0&&geometry.tab>=0,label+' spread clipping '+JSON.stringify(geometry));
    await page.screenshot({path:'ui-evidence/integrated-'+label+'-catalog.png'});
    await page.getByRole('button',{name:'메인으로'}).click();
    await page.getByRole('button',{name:'대전',exact:true}).click();
    assert.equal(await page.locator('.preview-hero-grid .preview-hero-tile').count(),9);
    await page.screenshot({path:'ui-evidence/hero-choice-'+label+'.png'});
    await page.getByRole('button',{name:'전사',exact:true}).click();
    await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).click();
    await page.locator('.mulligan-cards .battle-card').first().waitFor();
    const selected=page.locator('.mulligan-cards .battle-card').first();
    assert.equal(await page.locator('.compact-home-trigger').count(),0);
    await selected.click();
    assert.equal(await selected.getAttribute('aria-pressed'),'true');
    assert.equal(await selected.locator('.mulligan-replace-cross').isVisible(),true);
    await page.screenshot({path:'ui-evidence/mulligan-'+label+'.png'});
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
    await page.locator('.mulligan-cards .battle-card').first().click();
    await page.locator('.mulligan-confirm').click();
    await page.locator('.mulligan-cards[data-exchange=reveal] .mulligan-card-back').first().waitFor();
    const hand=page.locator('.own-hand .hand-card-slot .battle-card').first();
    assert.equal(await page.locator('.compact-home-trigger').count(),0);
    await hand.waitFor();
    if(hasTouch){
      const point=await hand.evaluate(card=>{
        const box=card.getBoundingClientRect();
        const x=box.left+box.width/2;
        for(let y=Math.max(1,box.top+4);y<Math.min(innerHeight,box.bottom);y+=4){
          if(card.contains(document.elementFromPoint(x,y)))return {x,y};
        }
        return null;
      });
      assert.ok(point,label+' hand card has a visible touch target');
      await page.touchscreen.tap(point.x,point.y);
    }
    else await hand.hover();
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.own-hand .hand-card-slot .battle-card')).position==='absolute');
    await page.waitForTimeout(120);
    const {top,bottom}=await hand.evaluate(card=>({
      top:card.getBoundingClientRect().top,
      bottom:document.querySelector('.friendly-board').getBoundingClientRect().bottom,
    }));
    assert.ok(top>=bottom-1&&top<=bottom+12,label+' hand preview clearance '+(top-bottom));
    await page.screenshot({path:'ui-evidence/hand-'+label+'.png'});
    t.diagnostic(label+' reward='+reward.width+'×'+reward.height+' hand clearance='+(top-bottom).toFixed(1)+'px');
    assert.deepEqual(errors,[]);
    await context.close();
  }
});

test('all nine class portraits fit the requested landscape viewports',{timeout:90000},async t=>{
  const {browser,url}=await previewBrowser(t);
  const sizes=[[1920,1080,false],[1600,900,false],[1366,768,false],[1280,720,false],
    [1280,800,true],[1180,820,true],[1024,768,true],[932,430,true],[844,390,true],[780,360,true],[640,360,true]];
  for(const [width,height,hasTouch] of sizes){
    const context=await browser.newContext({viewport:{width,height},hasTouch,isMobile:hasTouch,deviceScaleFactor:hasTouch?2:1});
    try{
      const page=await context.newPage();
      page.setDefaultTimeout(8000);
      await page.goto(url);
      await page.getByRole('button',{name:'슬롯 1 선택',exact:true}).click();
      await page.getByRole('button',{name:'대전',exact:true}).click();
      const tiles=page.locator('.preview-hero-tile');
      await tiles.first().waitFor();
      const home=await page.getByRole('button',{name:'메인으로',exact:true}).boundingBox();
      const settings=await page.getByRole('button',{name:'설정',exact:true}).boundingBox();
      const geometry=await tiles.evaluateAll(items=>items.map(tile=>{
        const rect=tile.getBoundingClientRect();
        const art=tile.querySelector('.preview-hero-art');
        const portrait=art.getBoundingClientRect();
        return {x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom,
          width:portrait.width/rect.width,height:portrait.height/rect.height,
          corner:parseFloat(getComputedStyle(art).borderTopLeftRadius)};
      }));
      assert.equal(geometry.length,9);
      for(const tile of geometry){
        const context=width+'x'+height+' '+JSON.stringify(tile);
        assert.ok(tile.x>=0&&tile.y>=0&&tile.right<=width+1&&tile.bottom<=height+1,context);
        for(const control of [home,settings]){
          assert.ok(control&&
            (tile.x>=control.x+control.width||tile.right<=control.x||
              tile.y>=control.y+control.height||tile.bottom<=control.y),context+' overlaps navigation '+JSON.stringify(control));
        }
        assert.ok(tile.width>=.85&&tile.height>=.65&&tile.corner>=8&&tile.corner<=12,context);
      }
    }finally{await context.close();}
  }
});
