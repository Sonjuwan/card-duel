import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {basicDeck} from '../../../packages/basic-decks.ts';
import {LocalDuel} from '../src/local-duel.ts';
import {createOfflineRankedInput} from '../src/offline-growth.ts';
import {createHash} from 'node:crypto';
import {CardStore} from '../../server/card-store.ts';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';
import {loadCatalog} from '../../server/server.ts';
import {createGrowthBackup,offlineGrowth,readOfflineGrowth} from '../src/offline-growth.ts';

async function previewBrowser(t){
  const server=createSoloAppServer(process.env.CARD_DUEL_GEOMETRY_BASELINE);
  server.prependListener('request',req=>{
    if(req.url.startsWith('/ui-preview/'))req.url=req.url.slice('/ui-preview'.length);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{
    server.close(resolve);
    server.closeAllConnections();
  }));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  return {browser,url:'http://127.0.0.1:'+server.address().port+'/ui-preview/'};
}

async function expectFullCard(card){
  const geometry=await card.evaluate(element=>{
    const face=element.getBoundingClientRect();
    const art=element.querySelector('.card-art').getBoundingClientRect();
    const badge=element.querySelector('.card-mana').getBoundingClientRect();
    const copy=element.querySelector('.card-copy');
    return {ratio:face.width/face.height,artFraction:art.height/face.height,artCenter:art.x+art.width/2-face.x-face.width/2,
      badgeOverArt:badge.right>art.left&&badge.left<art.left+art.width/2&&badge.bottom>art.top&&badge.top<art.bottom,
      copyHeight:copy.clientHeight,copyOverflow:getComputedStyle(copy).overflowY};
  });
  assert.ok(Math.abs(geometry.ratio-1/1.55)<.02,JSON.stringify(geometry));
  assert.ok(geometry.artFraction>.43&&geometry.artFraction<.6,JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.artCenter)<1,JSON.stringify(geometry));
  assert.ok(geometry.badgeOverArt&&geometry.copyHeight>0,JSON.stringify(geometry));
  assert.ok(['auto','scroll'].includes(geometry.copyOverflow),JSON.stringify(geometry));
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
    if(height<=540)await page.getByRole('button',{name:'카드 필터',exact:true}).click();
    await page.getByRole('button',{name:'10마나 이상',exact:true}).click();
    await page.getByRole('button',{name:'필터 초기화',exact:true}).click();
    if(height<=540)await page.getByRole('dialog',{name:'카드 필터',exact:true}).getByRole('button',{name:'닫기',exact:true}).click();
    assert.equal(await page.locator('.collection-inspector-sidebar').count(),0);
    await page.waitForFunction(()=>{
      const selected=document.querySelector('.book-class-tabs button[aria-pressed=true]');
      const other=document.querySelector('.book-class-tabs button[aria-pressed=false]');
      const ratio=selected?.getBoundingClientRect().width/other?.getBoundingClientRect().width;
      return ratio>=1.39&&ratio<=1.51;
    });
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
    await expectFullCard(selected);
    const confirm=await page.locator('.mulligan-confirm').boundingBox();
    const heading=await page.locator('.mulligan-heading').boundingBox();
    assert.ok(confirm&&confirm.height>=44&&confirm.y+confirm.height<=height,label+' confirm fit');
    assert.ok(heading&&heading.y>=0&&heading.y+heading.height<confirm.y,label+' heading fit');
    await page.screenshot({path:'ui-evidence/mulligan-'+label+'.png'});
    await selected.click();assert.equal(await selected.getAttribute('aria-pressed'),'false');
    const battleSettings=page.getByRole('button',{name:'전투 설정'});
    await battleSettings.click();
    const toolbar=page.locator('.duel-toolbar');
    for(const heading of ['오디오','전투 연출','게임 관리']){
      assert.equal(await toolbar.getByRole('heading',{name:heading,exact:true}).count(),1);
    }
    const continueGame=toolbar.getByRole('button',{name:'게임 계속하기',exact:true});
    const continueBounds=await continueGame.boundingBox(),panel=await toolbar.boundingBox();
    assert.ok(panel&&panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width&&panel.y+panel.height<=height);
    assert.ok(continueBounds&&continueBounds.x>=0&&continueBounds.y>=0&&
      continueBounds.x+continueBounds.width<=width&&continueBounds.y+continueBounds.height<=height,JSON.stringify({label,continueBounds,panel}));
    for(const name of ['오디오','전투 연출','게임 관리']){
      const section=await toolbar.getByRole('heading',{name,exact:true}).boundingBox();
      assert.ok(section&&section.x>=panel.x&&section.x+section.width<=panel.x+panel.width,JSON.stringify({label,name,panel,section}));
    }
    await page.screenshot({path:'ui-evidence/battle-settings-'+label+'.png'});
    const quality=toolbar.getByRole('combobox',{name:'전투 연출 품질',exact:true});
    const initialQuality=await quality.inputValue();
    await quality.selectOption('economy');
    await continueGame.click();
    await selected.waitFor();
    await battleSettings.click();
    assert.equal(await quality.inputValue(),'economy');
    await quality.selectOption(initialQuality);
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
    await page.getByRole('button',{name:'대전',exact:true}).click();
    await resume.click();
    await page.locator('.mulligan-cards .battle-card').first().waitFor();
    await page.locator('.mulligan-cards .battle-card').first().click();
    await page.locator('.mulligan-confirm').click();
    await page.locator('.mulligan-cards[data-exchange=reveal] .mulligan-card-back').first().waitFor();
    // A turn-start draw legitimately redistributes the hand fan. Measure hover
    // only once the local player's turn and its last playback frame are settled.
    await page.waitForFunction(()=>document.querySelector('.end-turn.your-turn')&&
      !document.querySelector('.duel-screen.is-playing-fx'),null,{timeout:30000});
    const hand=page.locator('.own-hand .hand-card-slot .battle-card').first();
    assert.equal(await page.locator('.compact-home-trigger').count(),0);
    if(height<=540){
      const folded=page.locator('.folded-hand');
      await folded.waitFor();
      await hand.waitFor({state:'hidden'});
      const board=page.locator('.friendly-board');
      const before=await board.boundingBox();
      await folded.tap();
      await hand.waitFor();
      assert.deepEqual(await board.boundingBox(),before,label+' hand does not reflow the board');
      await page.screenshot({path:'ui-evidence/hand-'+label+'.png'});
      assert.equal(await folded.getAttribute('aria-expanded'),'true',label+' hand stays open between touches');
      await folded.tap();
      await hand.waitFor({state:'hidden'});
    }else if(!hasTouch){
      await hand.waitFor();
      const before=await hand.boundingBox();
      await hand.hover();
      await page.locator('[data-hover-preview]').waitFor();
      assert.deepEqual(await hand.boundingBox(),before,label+' hover leaves the hand card in place');
    }else{
      assert.equal(await page.locator('.folded-hand').isVisible(),false,label+' large-screen layout');
      await hand.waitFor();
    }
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


test('restored card rewards open each exact collection page without consuming ownership',{timeout:30000},async t=>{
  const {browser,url}=await previewBrowser(t);
  const growth=offlineGrowth(loadCatalog());
  const record=readOfflineGrowth(undefined,growth);
  const cards=growth.unlocks.filter(item=>!record.profile.ownedCards.includes(item.cardId)).slice(0,2);
  assert.equal(cards.length,2);
  const xp=cards.at(-1).xp;
  record.profile.xp=xp;
  record.profile.rewardRoad.paths.original.xp=xp;
  const backup=createGrowthBackup(record,growth);
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.setDefaultTimeout(9000);
  await page.goto(url);
  const openRewards=()=>page.getByRole('button',{name:/경험치 · 카드 획득/}).click();
  await openRewards();
  page.once('dialog',dialog=>void dialog.accept());
  await page.getByLabel('미진행 슬롯에 성장 백업 복원').setInputFiles({
    name:'growth-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))
  });
  assert.match(await page.locator('.game-error-toast').textContent(),/성장 백업을 복원했습니다/);
  mkdirSync('ui-evidence',{recursive:true});
  for(const {cardId} of cards){
    const reward=page.locator(`.road-stop[data-state="owned"] button[data-preview-card="${cardId}"]`);
    const count=await reward.count();
    if(count===0)await page.getByRole('button',{name:'이전 보상 구간'}).click();
    await reward.click();
    const highlight=page.locator(`.reward-card-focus [data-preview-card="${cardId}"]`);
    await highlight.waitFor();
    assert.equal(await highlight.count(),1);
    await page.screenshot({path:`ui-evidence/reward-${cardId}.png`});
    await page.getByRole('button',{name:'메인으로',exact:true}).click();
    await openRewards();
  }
});

test('saved match awards persist before each click-confirmed reveal on desktop, tablet and phone',{timeout:50000},async t=>{
  const {browser,url}=await previewBrowser(t);
  const {catalog,cards}=new CardStore().read();
  const growth=offlineGrowth(catalog),hash=createHash('sha256').update(JSON.stringify(cards)).digest('hex');
  const initial=readOfflineGrowth(undefined,growth);
  initial.profile.xp=13;
  initial.profile.rewardRoad.paths.original.xp=13;
  const input=createOfflineRankedInput({
    catalog,catalogHash:hash,deck:basicDeck(catalog,'warrior'),heroClass:'mage',difficulty:1,seed:3,code:'LOCAL-REWARD-CHECK'
  },initial,growth);
  const duel=new LocalDuel(input);
  duel.act(0,{type:'mulligan',replace:[]});
  duel.botStep();
  const snapshot=duel.checkpoint();
  snapshot.state.turn=snapshot.summary.turn=6;
  const expected=growth.unlocks.slice(0,2).map(item=>item.cardId);
  for (const [label,width,height,touch] of [['desktop',1280,800,false],['tablet',1024,768,true],['phone',844,390,true]]) {
    const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});
    try{
      const page=await context.newPage();
      page.setDefaultTimeout(7500);
      page.on('dialog',dialog=>void dialog.accept());
      await page.goto(url);
      await page.getByRole('button',{name:/경험치 · 카드 획득/}).click();
      await page.getByRole('heading',{name:'오리지널 보상의 길'}).waitFor();
      await page.evaluate(async({initial,snapshot})=>{
        const req=indexedDB.open('card-duel-solo-saves-v1-ui-preview',2);
        const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(['growth','matches'],'readwrite');
          tx.objectStore('growth').put(initial,'player');
          tx.objectStore('matches').put({hash:snapshot.catalogHash,owner:'fixture',snapshot});
          tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
        });
        db.close();
      },{initial,snapshot});
      await page.reload();
      await page.getByRole('button',{name:'대전',exact:true}).click();
      await page.getByRole('button',{name:'새로운 게임 시작'}).click();
      const overlay=page.getByRole('dialog',{name:'새 카드 획득'});
      const card=overlay.locator('[data-preview-card]');
      await overlay.waitFor();
      const press=()=>touch?page.touchscreen.tap(20,Math.floor(height/2)):page.mouse.click(20,Math.floor(height/2));
      await press();
      const ready=overlay.and(page.locator('[data-ready="true"]'));
      await ready.waitFor();
      await page.waitForTimeout(2450);
      assert.equal(await card.getAttribute('data-preview-card'),expected[0],label);
      assert.ok(await card.locator('.card-copy').isVisible());
      const bounds=await card.boundingBox();
      mkdirSync('ui-evidence',{recursive:true});
      await page.screenshot({path:`ui-evidence/reveal-${label}.png`});
      assert.ok(bounds&&bounds.height>=192&&bounds.y>=0&&bounds.y+bounds.height<=height,label+' '+JSON.stringify(bounds));
      await expectFullCard(card);
      const popup=await overlay.locator('.reward-reveal').boundingBox();
      assert.ok(Math.abs(bounds.x+bounds.width/2-popup.x-popup.width/2)<1,label+' reward center');
      const record=()=>page.evaluate(async()=>{
        const req=indexedDB.open('card-duel-solo-saves-v1-ui-preview',2);
        const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
        try{
          return await new Promise((resolve,reject)=>{
            const read=db.transaction('growth').objectStore('growth').get('player');
            read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);
          });
        }finally{db.close();}
      });
      const saved=await record();
      assert.equal(saved.profile.xp,28);
      assert.deepEqual(saved.settledMatchIds,[input.code]);
      assert.ok(expected.every(id=>saved.profile.ownedCards.includes(id)));
      if(touch){await press();await press();}
      else await page.mouse.dblclick(20,Math.floor(height/2));
      await overlay.locator(`[data-preview-card="${expected[1]}"]`).waitFor();
      await ready.waitFor();
      assert.equal(await card.count(),1);
      if(label==='phone'){
        await page.reload();
        await page.getByRole('button',{name:/경험치 · 카드 획득/}).waitFor();
      }else{
        await press();
        await overlay.waitFor({state:'detached'});
      }
      assert.deepEqual(await record(),saved,label);
    }finally{await context.close();}
  }
});

test('basic deck can be copied without replacing a named deck',{timeout:25000},async t=>{
  const {browser,url}=await previewBrowser(t);
  const original=basicDeck(loadCatalog(),'mage');
  const prior={name:'기존 마법사 덱',deck:original};
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  try{
    await context.addInitScript(saved=>{
      localStorage.setItem('card-duel-ui-preview-slot-1:card-duel-saved-decks',JSON.stringify([saved]));
    },prior);
    const page=await context.newPage();
    await page.goto(url);
    await page.getByRole('button',{name:'대전',exact:true}).tap();
    await page.getByRole('button',{name:'마법사',exact:true}).tap();
    await page.getByRole('button',{name:/^기본 덱\s*30장$/}).tap();
    assert.equal(await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).isEnabled(),true);
    await page.getByRole('button',{name:'기본 덱 복제 · 편집'}).tap();
    await page.locator('.deck-sidebar').waitFor();
    assert.equal(await page.getByPlaceholder('저장할 덱 이름').inputValue(),'');
    await page.getByPlaceholder('저장할 덱 이름').fill('기본 덱 복제본');
    await page.getByRole('button',{name:'덱 저장',exact:true}).tap();
    await page.waitForFunction(()=>localStorage.getItem('card-duel-ui-preview-slot-1:card-duel-saved-decks')?.includes('기본 덱 복제본'));
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('card-duel-ui-preview-slot-1:card-duel-saved-decks')));
    assert.deepEqual(saved.find(entry=>entry.name===prior.name),prior);
    assert.deepEqual(saved.find(entry=>entry.name==='기본 덱 복제본').deck,original);
  }finally{await context.close();}
});
