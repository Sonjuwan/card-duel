import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';

test('stalled local command remains locked, accepts a late acknowledgement or recovers only after confirmation',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage({viewport:{width:1280,height:900},offline:true});
  try{
    await page.clock.install();
    await page.addInitScript(()=>{
      const state={hold:false,release:null as (()=>void)|null};Object.defineProperty(window,'__testStall',{value:state});
      const original=Worker.prototype.postMessage;
      Worker.prototype.postMessage=function(this:Worker,message:any,options?:any){
        if(state.hold&&message?.type==='act'){state.release=()=>original.call(this,message,options);return;}
        original.call(this,message,options);
      };
    });
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);
    await page.getByText('기기 AI 대전은 자동으로 저장됩니다.').waitFor();
    await page.getByRole('button',{name:'개발자 모드',exact:true}).click();
    await page.getByLabel('선공·후공',{exact:true}).selectOption('first');
    await page.getByRole('button',{name:'AI 대전 시작'}).click();
    await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();await page.getByText('자동 저장됨',{exact:true}).waitFor();
    await page.evaluate(()=>{(window as any).__testStall.hold=true;});
    const confirm=page.getByRole('button',{name:/확정/}),recover=page.getByRole('button',{name:'마지막 저장으로 복구'});
    await confirm.click();await page.clock.fastForward(12001);await recover.waitFor();
    assert.equal(await confirm.isDisabled(),true);
    page.once('dialog',d=>void d.dismiss());await recover.click();assert.equal(await confirm.isDisabled(),true);
    await page.evaluate(()=>{const s=(window as any).__testStall;s.hold=false;s.release();});
    await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();await recover.waitFor({state:'hidden'});
    await page.evaluate(()=>{(window as any).__testStall.hold=true;});
    const endTurn=page.getByRole('button',{name:'턴 종료',exact:true});
    await endTurn.click();await page.clock.fastForward(12001);await recover.waitFor();assert.equal(await endTurn.isDisabled(),true);
    page.once('dialog',d=>void d.accept());await recover.click();
    const resume=page.getByRole('button',{name:'이어하기',exact:true});await resume.waitFor();
    await resume.click();await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();await recover.waitFor({state:'hidden'});
  }finally{await browser.close();}
});

test('worker interruption re-probes durable save without discarding or trusting stale lobby metadata',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage({viewport:{width:1280,height:900},offline:true});
  try{
    await page.addInitScript(()=>{
      const state={active:null as Worker|null,hold:false,release:null as (()=>void)|null};
      Object.defineProperty(window,'__testWorkerRecovery',{value:state});
      const original=Worker.prototype.postMessage;
      Worker.prototype.postMessage=function(this:Worker,message:any,options?:any){
        if(message?.type==='start')state.active=this;
        if(message?.type==='inspectSave'&&state.hold){state.release=()=>original.call(this,message,options);return;}
        original.call(this,message,options);
      };
    });
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);
    await page.getByText('기기 AI 대전은 자동으로 저장됩니다.').waitFor();
    await page.getByRole('button',{name:'개발자 모드',exact:true}).click();
    await page.getByLabel('선공·후공',{exact:true}).selectOption('first');
    await page.getByRole('button',{name:'AI 대전 시작'}).click();
    await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();await page.getByText('자동 저장됨',{exact:true}).waitFor();
    const before=await page.locator('.mulligan-cards .battle-card').evaluateAll(els=>els.map(el=>el.getAttribute('data-preview-card')));
    await page.evaluate(()=>{const s=(window as any).__testWorkerRecovery;s.hold=true;s.active.dispatchEvent(new Event('error'));});
    await page.getByText('저장 경기 재확인 중…',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'이어하기',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'저장 경기 제거'}).isDisabled(),true);
    await page.waitForFunction(()=>typeof (window as any).__testWorkerRecovery.release==='function');
    await page.evaluate(()=>{const s=(window as any).__testWorkerRecovery;s.hold=false;s.release();});
    await page.waitForFunction(()=>!document.querySelector<HTMLButtonElement>('.saved-duel-panel button')?.disabled);
    await page.getByRole('button',{name:'이어하기',exact:true}).click();
    await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();
    assert.deepEqual(await page.locator('.mulligan-cards .battle-card').evaluateAll(els=>els.map(el=>el.getAttribute('data-preview-card'))),before);
    await page.getByText('자동 저장됨',{exact:true}).waitFor();
  }finally{await browser.close();}
});

test('mobile solo emote displays both hero responses without spending mana or changing the board',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,offline:true});
  try{
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);
    await page.getByRole('button',{name:'개발자 모드',exact:true}).tap();
    await page.getByLabel('AI 난이도',{exact:true}).selectOption('3');
    await page.getByLabel('선공·후공',{exact:true}).selectOption('first');
    await page.getByRole('button',{name:'AI 대전 시작'}).tap();
    await page.getByRole('button',{name:/확정/}).tap();
    await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    const hand=await page.locator('.battle-hand .battle-card').count(),board=await page.locator('.friendly-minions .battle-minion').count();
    await page.locator('.battle-emote-menu summary').tap();
    await page.locator('.battle-emote-options button').filter({hasText:'인사'}).tap();
    await page.locator('.self-hero-zone .line-emote').waitFor();
    await page.locator('.enemy-hero-zone .line-emote').waitFor();
    assert.equal(await page.locator('.self-hero-zone .line-emote .dialogue-portrait [data-art-asset]').count(),1);
    assert.equal(await page.locator('.enemy-hero-zone .line-emote .dialogue-portrait [data-art-asset]').count(),1);
    assert.equal(await page.locator('.battle-hand .battle-card').count(),hand);
    assert.equal(await page.locator('.friendly-minions .battle-minion').count(),board);
    assert.equal(await page.locator('.self-hero-zone .battle-dialogue-captions').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    await page.locator('.dialogue-settings summary').tap();
    await page.getByLabel('효과음 볼륨',{exact:true}).fill('75');assert.equal(await page.evaluate(()=>localStorage.getItem('card-duel-sound-volume')),'75');
    await page.getByRole('button',{name:'대사 음성 켜짐'}).tap();
    assert.equal(await page.getByRole('button',{name:'대사 음성 꺼짐'}).getAttribute('aria-pressed'),'false');
    await page.getByLabel('대사 자막 표시').selectOption('off');
    await page.getByLabel('전투 연출 품질').selectOption('economy');assert.equal(await page.evaluate(()=>localStorage.getItem('card-duel-fx-quality')),'economy');
    await page.getByLabel('대사 볼륨',{exact:true}).fill('35');assert.equal(await page.getByLabel('대사 볼륨',{exact:true}).inputValue(),'35');
    await page.getByRole('button',{name:'내 영웅 음성 미리듣기'}).tap();assert.match(await page.locator('.voice-preview-status').textContent()??'',/볼륨을 켜/);
    assert.equal(await page.evaluate(()=>localStorage.getItem('card-duel-dialogue-captions')),'off');assert.equal(await page.evaluate(()=>localStorage.getItem('card-duel-dialogue-volume')),'35');
    assert.equal(await page.locator('.self-hero-zone .line-emote').count(),0);
    await page.keyboard.press('Escape');assert.equal(await page.locator('.dialogue-settings').evaluate(el=>(el as HTMLDetailsElement).open),false);
  }finally{await browser.close();}
});

test('card book arrows follow responsive columns and never add to a deck',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage({viewport:{width:1280,height:900},offline:true});
  try{
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);
    await page.getByRole('button',{name:'덱 편집',exact:true}).click();
    await page.getByRole('button',{name:'덱 만들기',exact:true}).click();
    const cards=page.locator('.deck-builder .collection-book .battle-card'),count=await cards.count(),before=await page.locator('.deck-live-count').textContent();
    assert.equal(count,12);await cards.first().focus();await page.keyboard.press('ArrowRight');
    assert.equal(await cards.nth(1).evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('End');assert.equal(await cards.last().evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Home');assert.equal(await cards.first().evaluate(el=>el===document.activeElement),true);
    await page.setViewportSize({width:320,height:852});await cards.first().focus();await page.keyboard.press('ArrowDown');
    assert.equal(await cards.nth(1).evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.locator('.deck-live-count').textContent(),before);
  }finally{await browser.close();}
});

test('mobile deck and collection display complete card text without forcing the deck below cards',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,offline:true});
  try{
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);
    await page.getByRole('button',{name:'덱 편집',exact:true}).tap();
    await page.getByRole('button',{name:'덱 만들기',exact:true}).tap();
    const card=page.locator('.deck-builder .collection-item .battle-card').first();
    const sidebar=page.locator('.deck-builder .deck-sidebar');
    for(const width of [320,393,768,1280]){
      await page.setViewportSize({width,height:852});
      await card.scrollIntoViewIfNeeded();
      const [a,b]=await Promise.all([card.boundingBox(),sidebar.boundingBox()]);
      assert.ok(a&&b&&a.x+a.width<=b.x+1&&b.x+b.width<=width+1&&b.y<852&&b.y+b.height>0,'cards and deck must be side by side and visible');
      assert.match(await sidebar.locator('.deck-live-count').textContent()??'',/30\/30/);
      assert.equal(await page.locator('.deck-builder .collection-item .card-copy').evaluateAll(els=>els.every(e=>e.scrollHeight<=e.clientHeight+1)),true);
    }
    await page.setViewportSize({width:393,height:852});
    await page.getByRole('button',{name:'카드 보기',exact:true}).tap();
    const copy=page.locator('.card-browser .collection-item .card-copy').first();
    await copy.evaluate(el=>{el.textContent=('여러 줄에 걸쳐 아주 긴 카드 설명을 표시해야 합니다. ').repeat(12);});
    assert.equal(await copy.evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.getBoundingClientRect().bottom<=el.closest('.battle-card')!.getBoundingClientRect().bottom),true);
  }finally{await browser.close();}
});

test('real mobile touch drag crosses implicit capture handoff and summons a minion',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,offline:true});
  try{
    const active=JSON.parse(readFileSync('data/cards/active.json','utf8')) as {file:string};
    const raw=readFileSync('data/cards/'+active.file,'utf8');
    const hash=createHash('sha256').update(raw).digest('hex');
    // Every card is an untargeted neutral minion affordable on turn one.
    const ids=['recruit','night_cat','reef_scout','reef_oracle','wild_boar','deckhand','young_hawk','wisp','silver_squire','plague_gnome','heavy_shield','light_warden','young_priestess','angry_chicken','secret_keeper'];
    await page.addInitScript(({hash,ids})=>{localStorage.setItem('card-duel-developer-draft-'+hash,JSON.stringify({heroClass:'warrior',cards:ids.flatMap(id=>[id,id])}));},{hash,ids});
    await page.addInitScript(()=>{const pulses:number[][]=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:(p:number|number[])=>{if(Array.isArray(p))pulses.push(p);return true;}});Object.defineProperty(window,'__testHapticPulses',{value:pulses});});
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);
    await page.getByRole('button',{name:'개발자 모드',exact:true}).tap();
    await page.getByLabel('AI 난이도',{exact:true}).selectOption('3');
    await page.getByLabel('선공·후공',{exact:true}).selectOption('first');
    await page.getByRole('button',{name:'AI 대전 시작'}).tap();
    await page.getByRole('button',{name:/확정/}).tap();
    await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    await page.locator('.dialogue-settings summary').tap();await page.getByRole('button',{name:'전투 진동 꺼짐'}).tap();assert.equal(await page.getByRole('button',{name:'전투 진동 켜짐'}).getAttribute('aria-pressed'),'true');await page.locator('.dialogue-settings summary').tap();
    const hand=page.locator('.battle-hand .battle-card.kind-minion[aria-disabled="false"]').first();
    const board=page.locator('.friendly-board');await hand.waitFor();await hand.scrollIntoViewIfNeeded();
    const a=await hand.boundingBox(),b=await board.boundingBox();assert.ok(a&&b);
    const x=a.x+a.width/2,y=a.y+a.height/2,tx=b.x+b.width/2,ty=b.y+b.height/2;
    const initial=await page.locator('.friendly-minions .battle-minion').count();
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-18,id:1}]});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*i/8,y:y-18+(ty-y+18)*i/8,id:1}]});
    await page.locator('.touch-drag-ghost').waitFor();
    await page.locator('.position-slot.touch-drop-hover[data-drop-position="0"]').waitFor();
    await page.locator('.arena-message[data-drop-feedback="action"]').waitFor();
    // App/window focus loss cancels the gesture, even if the old pointer
    // releases over a valid slot. A fresh touch works immediately afterward.
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.locator('.touch-drag-ghost').waitFor({state:'hidden'});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await page.locator('.friendly-minions .battle-minion').count(),initial);
    // A genuine keyboard activation remains available during the delayed
    // touch-click guard. It selects but cannot spend mana without confirmation.
    await hand.focus();await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'선택 카드 내기'}).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button',{name:'선택 카드 내기'}).count(),0);
    assert.equal(await page.locator('.friendly-minions .battle-minion').count(),initial);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-18,id:2}]});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*i/8,y:y-18+(ty-y+18)*i/8,id:2}]});
    await page.locator('.arena-message[data-drop-feedback="action"]').waitFor();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.locator('.friendly-minions .battle-minion').nth(initial).waitFor();
    assert.equal(await page.locator('.friendly-minions .battle-minion').count(),initial+1);
    await page.waitForFunction(()=>((window as unknown as {__testHapticPulses:number[][]}).__testHapticPulses??[]).some(p=>p[0]===18));
    await page.locator('.touch-drag-ghost').waitFor({state:'hidden'});
    // Force a narrow row to validate the resize-detected scroll affordance
    // independently of random hand draws or opponent board actions.
    const row=page.locator('.friendly-minions');await row.evaluate(el=>{el.style.maxWidth='40px';});await page.locator('.friendly-minions[data-scrollable="true"]').waitFor();
    assert.equal(await row.locator('.battle-minion').first().evaluate(el=>getComputedStyle(el).touchAction),'pan-x');
    await row.evaluate(el=>{el.style.maxWidth='';});await page.locator('.friendly-minions[data-scrollable="false"]').waitFor();
    await cdp.detach();
  }finally{await browser.close();}
});
test('mobile deck editor inspection never adds or removes a card; only the minus button removes one',{timeout:30000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,offline:true});
  try{
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);await page.getByRole('button',{name:'덱 편집',exact:true}).tap();await page.getByRole('button',{name:'덱 만들기',exact:true}).tap();
    const editor=page.locator('.deck-panel'),count=editor.locator('.section-title>strong');const before=await count.textContent();assert.match(before??'',/30장/);
    const dialog=page.getByRole('dialog',{name:'카드 확대 상세'}),trigger=editor.locator('.deck-card-detail-trigger').first();await trigger.tap();await dialog.waitFor();await dialog.getByRole('button',{name:'닫기',exact:true}).tap();assert.equal(await count.textContent(),before);
    await editor.locator('.deck-inspect-row').first().tap();await dialog.waitFor();await dialog.getByRole('button',{name:'닫기',exact:true}).tap();assert.equal(await count.textContent(),before);
    await editor.locator('.deck-remove').first().tap();assert.equal(await count.textContent(),`${Number(before!.split('/')[0])-1}/30장`);assert.match(await editor.locator('.deck-edit-notice').textContent()??'',/1장 제거/);
    const add=editor.locator('.collection-item .battle-card[aria-disabled="false"]').first();await add.tap();assert.equal(await count.textContent(),before);assert.match(await editor.locator('.deck-edit-notice').textContent()??'',/1장 추가/);
  }finally{await browser.close();}
});
test('mobile collection tap opens enlarged card art and closes without navigating or changing the deck',{timeout:30000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,offline:true});
  try{
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);
    await page.getByRole('button',{name:'덱 편집',exact:true}).tap();await page.getByRole('button',{name:'카드 보기',exact:true}).tap();
    const card=page.locator('.card-browser .collection-item .battle-card').first();const art=card.locator('.painted-art');const artClass=await art.getAttribute('class');
    await card.tap();const dialog=page.getByRole('dialog',{name:'카드 확대 상세'});await dialog.waitFor();assert.equal(await dialog.locator('.collection-detail-art .painted-art').getAttribute('class'),artClass);
    const bounds=await dialog.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=394&&bounds.y+bounds.height<=853);
    await dialog.getByRole('button',{name:'닫기',exact:true}).tap();await dialog.waitFor({state:'hidden'});assert.ok(await page.getByRole('heading',{name:'카드 보기'}).isVisible());
    await page.setViewportSize({width:1280,height:800});await card.click();assert.equal(await dialog.isVisible(),false);assert.equal(await page.locator('.card-browser .deck-sidebar .inspect-heading .painted-art').getAttribute('class'),artClass);
  }finally{await browser.close();}
});
test('offline solo full React application works with internet disabled on a phone-size viewport',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,offline:true});
  const page=await context.newPage(),external:string[]=[],errors:string[]=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);
    await page.getByText('● 오프라인 솔로').waitFor();assert.equal(await page.getByText('친구와 1:1 대전').count(),0);
    await page.getByText('기기 AI 대전은 자동으로 저장됩니다.').waitFor();
    await page.getByRole('button',{name:'개발자 모드',exact:true}).click();
    await page.getByLabel('AI 난이도',{exact:true}).selectOption('3');await page.getByLabel('선공·후공',{exact:true}).selectOption('first');await page.getByRole('button',{name:'AI 대전 시작'}).click();
    await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();await page.getByText('자동 저장됨',{exact:true}).waitFor();
    const toolbar=page.getByRole('group',{name:'대전 설정 및 저장'});await toolbar.waitFor();assert.equal(await toolbar.evaluate(el=>[el,...el.querySelectorAll('button,input')].every(item=>{const r=item.getBoundingClientRect();return r.left>=-1&&r.right<=window.innerWidth+1;})),true);
    await page.reload();await page.getByRole('button',{name:'이어하기',exact:true}).click();await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();
    const initialCard=page.locator('.mulligan-cards .battle-card').first();await initialCard.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;const event=(type:string,dy:number)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:29,pointerType:'touch',isPrimary:true,clientX:x,clientY:y+dy}));event('pointerdown',0);event('pointermove',24);event('pointerup',24);el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));});assert.equal(await initialCard.getAttribute('aria-pressed'),'false');
    await initialCard.tap();assert.equal(await initialCard.getAttribute('aria-pressed'),'true');await initialCard.tap();assert.equal(await initialCard.getAttribute('aria-pressed'),'false');await page.getByRole('button',{name:/확정/}).click();
    await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    await page.getByRole('button',{name:'저장 후 나가기'}).click();await page.getByRole('button',{name:'이어하기',exact:true}).waitFor();await page.getByRole('button',{name:'이어하기',exact:true}).click();await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    const card=page.locator('.battle-hand .battle-card[aria-disabled="false"]').first();
    if(await card.count()){
      // Reproduce a mobile browser delivering a click after a horizontal hand
      // gesture even when the hand cannot scroll any further.
      await card.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;const event=(type:string,dx:number)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:41,pointerType:'touch',isPrimary:true,clientX:x+dx,clientY:y}));event('pointerdown',0);event('pointermove',36);event('pointerup',36);el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));});
      assert.notEqual(await card.getAttribute('aria-pressed'),'true');assert.equal(await page.getByRole('button',{name:'선택 카드 내기'}).count(),0);
      // A new physical tap must work immediately, without waiting out the
      // previous gesture's synthetic-click guard.
      await card.tap();await page.getByRole('button',{name:'선택 카드 내기'}).waitFor();assert.equal(await card.getAttribute('aria-pressed'),'true');
      if((await card.getAttribute('class'))?.includes('kind-minion')){
        const gap=page.getByRole('button',{name:'하수인 배치 위치 1',exact:true});await gap.tap();
        assert.equal(await gap.getAttribute('aria-pressed'),'true');assert.match(await page.locator('.arena-message [role="status"]').innerText(),/배치 1번/);
        assert.equal(await card.getAttribute('aria-pressed'),'true');
      }
      await page.getByRole('button',{name:'선택 취소'}).tap();
    }
    await page.getByRole('button',{name:'턴 종료'}).click();await page.getByRole('heading',{name:'AI 턴',exact:true}).waitFor();await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'항복'}).click();await page.getByRole('heading',{name:'패배',exact:true}).waitFor();
    await page.getByRole('button',{name:'같은 상대와 재대전'}).click();await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});

test('desktop native drag shares the mobile placement and rejected-control feedback',{timeout:60000},async t=>{
  const html=readFileSync(new URL('../../../solo-offline.html',import.meta.url));
  const server=createServer((_req,res)=>res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const address=server.address();
  assert.ok(address&&typeof address!=='string');
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.setDefaultTimeout(8000);
  try{
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.getByRole('button',{name:'대전',exact:true}).click();
    await page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기',exact:true}).click();
    const slots=page.getByRole('dialog',{name:'슬롯 · 성장 · 저장 경기',exact:true});
    await slots.getByRole('button',{name:'개발자 모드',exact:true}).click();
    await slots.getByRole('button',{name:'닫기',exact:true}).click();
    await page.getByRole('button',{name:'AI 연습 대전',exact:true}).click();
    await page.getByRole('dialog',{name:'AI 연습 대전'}).locator('label').filter({hasText:'선공·후공'}).locator('select').selectOption('first');
    await page.getByRole('button',{name:'AI 대전 시작'}).click();
    await page.getByRole('button',{name:/확정/}).click();
    const turn=page.locator('.end-turn.your-turn');
    await turn.waitFor();
    const card=page.locator('.battle-hand .battle-card.kind-minion[aria-disabled="false"]').first();
    for(let round=0;round<3&&await card.count()===0;round++){
      await turn.click();
      await turn.waitFor({state:'hidden'});
      await turn.waitFor({timeout:20000});
    }
    await card.waitFor();
    const minions=page.locator('.friendly-minions .battle-minion'),count=await minions.count();
    await card.dragTo(page.locator('.self-hero-zone .hero-power'));
    assert.equal(await minions.count(),count);
    const stage=page.locator('.fx-play-card[data-card-reveal-kind="summon"]');
    await card.dragTo(page.locator('.friendly-board .position-slot[data-drop-position="0"]'));
    await stage.waitFor();
    assert.equal(await stage.locator('.battle-card').count(),1);
    assert.equal(await stage.locator('.fx-summon-portrait').count(),1);
    mkdirSync('ui-evidence',{recursive:true});
    await page.screenshot({path:'ui-evidence/summon-transition.png'});
    await minions.nth(count).waitFor();
    assert.equal(await minions.count(),count+1);
  }finally{await browser.close();}
});
test('desktop player can select and confirm a hand card without dragging',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage({viewport:{width:1280,height:800},offline:true});
  try{
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);
    await page.getByRole('button',{name:'개발자 모드',exact:true}).click();
    await page.getByLabel('AI 난이도',{exact:true}).selectOption('3');await page.getByLabel('선공·후공',{exact:true}).selectOption('first');await page.getByRole('button',{name:'AI 대전 시작'}).click();
    await page.getByRole('button',{name:/확정/}).click();await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    const card=page.locator('.battle-hand .battle-card[aria-disabled="false"]').first();
    if(await card.count()===0){await page.getByRole('button',{name:'턴 종료',exact:true}).click();await page.getByRole('heading',{name:'AI 턴',exact:true}).waitFor();await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();}
    await card.click();const confirm=page.getByRole('button',{name:'선택 카드 내기',exact:true});await confirm.waitFor();assert.equal(await confirm.isVisible(),true);assert.equal(await card.getAttribute('aria-pressed'),'true');
    await page.getByRole('button',{name:'선택 취소'}).click();await confirm.waitFor({state:'hidden'});
    await card.click();await confirm.click();await confirm.waitFor({state:'hidden'});
  }finally{await browser.close();}
});

test('mobile targeted hero power can be canceled by pressing its own source again',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,offline:true});
  try{
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);
    await page.locator('.hero-gallery .class-choice.faction-mage').tap();
    await page.getByRole('button',{name:'개발자 모드',exact:true}).click();await page.getByLabel('AI 난이도',{exact:true}).selectOption('3');await page.getByLabel('선공·후공',{exact:true}).selectOption('first');await page.getByRole('button',{name:'AI 대전 시작'}).click();await page.getByRole('button',{name:/확정/}).click();await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    await page.getByRole('button',{name:'턴 종료',exact:true}).click();await page.getByRole('heading',{name:'AI 턴',exact:true}).waitFor();await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    const power=page.locator('.self-hero-zone .hero-power[aria-disabled="false"]');await power.waitFor();
    await power.tap();assert.equal(await power.getAttribute('aria-pressed'),'true');assert.ok(await page.locator('.hero-portrait.is-targeted').count()>0);
    // An emote is an independent overlay. Escape closes it without bubbling
    // into the arena's selected-card/attack cancel handler.
    await page.locator('.battle-emote-menu summary').tap();
    const emotePanel=page.locator('.battle-emote-options');
    const emoteBounds=await emotePanel.boundingBox();
    assert.ok(emoteBounds&&emoteBounds.y>=-1&&emoteBounds.y+emoteBounds.height<=852,'mobile menu stays inside the visual viewport');
    await page.locator('.battle-emote-close').tap();
    assert.equal(await page.locator('.battle-emote-menu').evaluate(el=>(el as HTMLDetailsElement).open),false);
    assert.equal(await power.getAttribute('aria-pressed'),'true','closing emotes keeps the selected power');
    await page.locator('.battle-emote-menu summary').tap();
    await page.locator('.battle-emote-close').focus();await page.keyboard.press('Escape');
    assert.equal(await page.locator('.battle-emote-menu').evaluate(el=>(el as HTMLDetailsElement).open),false);
    assert.equal(await power.getAttribute('aria-pressed'),'true','Escape from an emote is not a global cancel');
    await page.setViewportSize({width:844,height:390});
    for(const selector of ['.end-turn','.concede-button','.landscape-card-detail summary']){
      const height=await page.locator(selector).evaluate(el=>(el as HTMLElement).getBoundingClientRect().height);
      assert.ok(height>=43.9,`${selector}: landscape minimum touch target 44px`);
    }
    await page.setViewportSize({width:393,height:852});
    await power.press('ArrowRight');assert.equal(await page.locator('.is-targeted:focus').count(),1);
    await page.keyboard.press('End');assert.equal(await page.locator('.is-targeted').last().evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Escape');assert.equal(await power.evaluate(el=>el===document.activeElement),true);assert.equal(await power.getAttribute('aria-pressed'),'false');
    await power.tap();assert.equal(await power.getAttribute('aria-pressed'),'true');
    await power.tap();assert.equal(await power.getAttribute('aria-pressed'),'false');assert.equal(await page.locator('.is-targeted').count(),0);assert.equal(await power.getAttribute('aria-disabled'),'false');
    await power.tap();await page.locator('.target-picker summary').tap();assert.match((await page.locator('.target-picker summary').getAttribute('aria-label'))??'',/선택 가능한 대상 [0-9]+개/);const rows=page.locator('.target-picker-row');assert.equal(await rows.count(),await page.locator('.is-targeted').count());
    assert.ok((await rows.first().boundingBox())!.height>=44);
    const panel=page.locator('.target-picker-panel'),close=page.locator('.target-picker-close');
    assert.equal(await close.evaluate(el=>getComputedStyle(el).position),'sticky');
    await page.locator('.target-picker summary').focus();await page.keyboard.press('ArrowDown');
    assert.equal(await rows.first().evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('End');assert.equal(await rows.last().evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Home');assert.equal(await rows.first().evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('PageDown');assert.equal(await rows.last().evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('PageUp');assert.equal(await rows.first().evaluate(el=>el===document.activeElement),true);
    // Force a tiny list viewport: Close must remain reachable after scrolling
    // to the bottom of a long target list, including landscape phone layouts.
    await panel.evaluate(el=>{const p=el as HTMLElement;p.style.maxHeight='90px';p.scrollTop=p.scrollHeight;});
    const closeBounds=(await close.boundingBox())!,panelBounds=(await panel.boundingBox())!;
    assert.ok(closeBounds.y>=panelBounds.y-2&&closeBounds.y<panelBounds.y+48);
    await close.tap();assert.equal(await power.getAttribute('aria-pressed'),'true');
    await page.locator('.target-picker summary').tap();await page.keyboard.press('Escape');
    assert.equal(await power.getAttribute('aria-pressed'),'true','first Escape only collapses the target picker');
    await page.locator('.target-picker summary').tap();await rows.first().tap();await page.locator('.target-picker').waitFor({state:'hidden'});
    await page.locator('.self-hero-zone .hero-power[aria-disabled="true"]').waitFor();
  }finally{await browser.close();}
});

test('desktop keyboard navigates hand cards, focuses explicit play, and cancels without spending mana',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});const page=await browser.newPage({viewport:{width:1280,height:900},offline:true});
  try{
    const active=JSON.parse(readFileSync('data/cards/active.json','utf8')) as {file:string},hash=createHash('sha256').update(readFileSync('data/cards/'+active.file,'utf8')).digest('hex');
    const ids=['recruit','night_cat','reef_scout','reef_oracle','wild_boar','deckhand','young_hawk','wisp','silver_squire','plague_gnome','heavy_shield','light_warden','young_priestess','angry_chicken','secret_keeper'];
    await page.addInitScript(({hash,ids})=>localStorage.setItem('card-duel-developer-draft-'+hash,JSON.stringify({heroClass:'warrior',cards:ids.flatMap(id=>[id,id])})),{hash,ids});
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);await page.getByRole('button',{name:'개발자 모드',exact:true}).click();await page.getByLabel('AI 난이도',{exact:true}).selectOption('3');await page.getByLabel('선공·후공',{exact:true}).selectOption('first');await page.getByRole('button',{name:'AI 대전 시작'}).click();await page.getByRole('button',{name:/확정/}).click();await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    const hand=page.locator('.battle-hand .battle-card'),count=await hand.count();assert.ok(count>1);await hand.first().focus();await page.keyboard.press('End');assert.equal(await hand.last().evaluate(el=>el===document.activeElement),true);await page.keyboard.press('ArrowRight');assert.equal(await hand.first().evaluate(el=>el===document.activeElement),true);
    const source=page.locator('.battle-hand .battle-card.kind-minion[aria-disabled="false"]').first();await source.waitFor();await source.press('Enter');const confirm=page.locator('.selected-card-use');await confirm.waitFor();assert.equal(await confirm.evaluate(el=>el===document.activeElement),true);assert.equal(await hand.count(),count);assert.equal(await page.locator('.friendly-board .battle-minion').count(),0);
    await page.keyboard.press('Escape');assert.equal(await source.evaluate(el=>el===document.activeElement),true);assert.equal(await hand.count(),count);assert.equal(await confirm.count(),0);
    await source.press('Enter');await confirm.press('Enter');await page.locator('.friendly-board .battle-minion').first().waitFor();assert.equal(await hand.count(),count-1);
    await page.waitForFunction(()=>document.activeElement?.matches('[data-action-source][aria-disabled="false"],.end-turn:not(:disabled)')===true);
  }finally{await browser.close();}
});

test('offline ranked profile survives reload and result replay without a duplicate award',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,offline:true});
  const page=await context.newPage();const url=new URL('../../../solo-offline.html',import.meta.url).href;
  try{
    await page.goto(url);await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).waitFor();await page.getByText('랭크 전적 0승 0패 0무').waitFor();
    await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).click();await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();await page.getByText('자동 저장됨',{exact:true}).waitFor();
    await page.reload();await page.getByText('진행 중인 랭크 대전',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'저장 경기 제거'}).isDisabled(),true);
    await page.getByRole('button',{name:'이어하기',exact:true}).click();await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();await page.getByRole('button',{name:/확정/}).click();
    page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'항복'}).click();await page.getByRole('heading',{name:'패배',exact:true}).waitFor();await page.getByText('조기 항복은 XP 보상에 포함되지 않습니다.').waitFor();
    await page.getByRole('button',{name:'대전 준비로 돌아가기'}).click();await page.getByText('랭크 전적 0승 1패 0무').waitFor();
    await page.reload();await page.getByText('랭크 전적 0승 1패 0무').waitFor();await page.getByRole('button',{name:'결과 보기'}).click();await page.getByRole('heading',{name:'패배',exact:true}).waitFor();await page.getByRole('button',{name:'대전 준비로 돌아가기'}).click();await page.getByText('랭크 전적 0승 1패 0무').waitFor();
  }finally{await browser.close();}
});
