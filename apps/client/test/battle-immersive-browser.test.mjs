import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {createCatalog,practiceDeck} from '../../../packages/engine/src/index.ts';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';

test('phone/tablet combat uses entire available height instead of three redundant header rows',{timeout:120000},async t=>{
  const server=createSoloAppServer(process.env.CARD_DUEL_GEOMETRY_BASELINE);
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
    ['desktop-1366',1366,768,false],
    ['desktop-1920',1920,1080,false],
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
        boardHeight:rect('.enemy-board').height+rect('.friendly-board').height,arenaTop:arena?.top,arenaHeight:arena?.height,mainTop:main?.top,mainHeight:main?.height,
        leaveTouch:button?.height??0,endTurnTouch:turn?.height??0,
        statusVisible:style(message+'>span:nth-child(2)').clipPath,
      };
    });
    t.diagnostic(label+' board rows '+result.boardHeight.toFixed(1)+'px / '+height+'px');
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

test('mobile fullscreen stays enter-only and dense combat fits seven units and ten cards',{timeout:120000},async t=>{
  const server=createSoloAppServer();
  server.prependListener('request',req=>{if(req.url?.startsWith('/ui-preview/'))req.url=req.url.slice('/ui-preview'.length);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:780,height:360},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  // Exercise the real worker/React path, then supply a display-only snapshot.
  // The injected snapshot is never sent to the worker or written to storage.
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker{
      set onmessage(handler){
        super.onmessage=event=>{
          const data=event.data;
          if(window.denseFixtureActive&&data?.type==='view')return;
          if(data?.type==='view'&&data.view?.state?.phase==='playing')window.denseBoard=()=>{
            window.denseFixtureActive=true;
            const fixture=structuredClone(data),view=fixture.view.state;
            fixture.view.animation=undefined;
            view.revision+=1;
            for(const [i,side] of [view.self,view.opponent].entries()){
              side.board=Array.from({length:7},(_,j)=>({cardId:'wolf',instanceId:`fixture-${i}-${j}`,attack:12,health:18,maxHealth:18,attacksRemaining:1,keywords:['taunt','divineShield']}));
              side.handCount=10;
            }
            view.self.hand=Array.from({length:10},(_,i)=>({cardId:'wolf',instanceId:'fixture-card-'+i}));
            handler.call(this,new MessageEvent('message',{data:fixture}));
          };
          handler?.call(this,event);
        };
      }
    };
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/ui-preview/');
  await page.getByRole('button',{name:'슬롯 1 선택',exact:true}).click();
  const menu=page.locator('.lobby-home .landscape-menu-button');
  assert.match(await menu.textContent(),/가로 전체화면/);
  await page.setViewportSize({width:360,height:780});
  const portraitButton=page.getByRole('dialog',{name:'가로 화면 안내'}).getByRole('button',{name:'가로 전체화면',exact:true});
  await portraitButton.tap();
  await page.waitForFunction(()=>document.fullscreenElement!==null||document.querySelector('.rotate-device-status')?.textContent.includes('가로'));
  const enteredFullscreen=await page.evaluate(()=>!!document.fullscreenElement);
  const metrics=await context.newCDPSession(page);
  const landscape=(width,height)=>metrics.send('Emulation.setDeviceMetricsOverride',{
    width,height,deviceScaleFactor:1,mobile:true,screenOrientation:{type:'landscapePrimary',angle:90},
  });
  await landscape(780,360);
  await portraitButton.waitFor({state:'hidden'});
  assert.match(await menu.textContent(),/가로 전체화면/);
  await page.getByRole('button',{name:'대전',exact:true}).tap();
  await page.getByRole('button',{name:'전사',exact:true}).tap();
  await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).tap();
  if(enteredFullscreen)assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);
  t.diagnostic(enteredFullscreen?'Chromium Fullscreen API entered and persisted':'Chromium showed manual rotation guidance');
  await page.locator('.mulligan-confirm').tap();
  await page.waitForFunction(()=>Boolean(window.denseBoard));
  await page.evaluate(()=>window.denseBoard());
  await page.locator('.enemy-board .battle-minion').nth(6).waitFor();
  await page.locator('.friendly-board .battle-minion').nth(6).waitFor();
  await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
  await metrics.detach();
  for(const width of [640,780,844,1024]){
    await page.setViewportSize({width,height:width===1024?768:360});
    const dimensions=await page.evaluate(()=>{
      const box=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
      const rows=['.enemy-board','.friendly-board'].map(selector=>{
        const row=box(selector),units=[...document.querySelectorAll(selector+' .battle-minion')].map(el=>el.getBoundingClientRect().toJSON());
        return {row,units};
      });
      return {rows,arena:box('.battle-arena'),width:innerWidth,height:innerHeight,
        scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
        rail:getComputedStyle(document.querySelector('.arena-right')).display};
    });
    assert.equal(dimensions.rail,'contents');
    assert.deepEqual(dimensions.scroll,[dimensions.width,dimensions.height]);
    for(const {row,units} of dimensions.rows){
      assert.equal(units.length,7);
      for(const [i,unit] of units.entries()){
        assert.ok(unit.x>=row.x&&unit.right<=row.right&&unit.top>=row.top-1&&unit.bottom<=row.bottom+1,JSON.stringify({width,row,unit}));
        if(i)assert.ok(units[i-1].right<=unit.left,JSON.stringify({width,units}));
      }
    }
    const share=dimensions.rows.reduce((sum,{row})=>sum+row.height,0)/dimensions.height;
    t.diagnostic(width+'px board share '+(share*100).toFixed(1)+'%');
    assert.ok(share>=.65, String(share));
    const hand=page.locator('.folded-hand');
    const board=page.locator('.friendly-board');
    const before=await board.boundingBox();
    await hand.tap();
    const targets=await page.locator('.own-hand .battle-card').evaluateAll(cards=>cards.map(card=>{
      const rect=card.getBoundingClientRect();
      return card.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2));
    }));
    assert.equal(targets.length,10);
    assert.ok(targets.every(Boolean),JSON.stringify({width,targets}));
    assert.deepEqual(await board.boundingBox(),before);
    await page.screenshot({path:`ui-evidence/dense-${width}.png`});
    await page.locator('.friendly-board').tap({position:{x:12,y:9}});
    assert.equal(await hand.getAttribute('aria-expanded'),'false');
  }
  await context.close();
});


test('touch drag plays a minion and targeted spell while turn end waits in the queue',{timeout:90000},async t=>{
  const server=createSoloAppServer();
  server.prependListener('request',req=>{if(req.url?.startsWith('/ui-preview/'))req.url=req.url.slice('/ui-preview'.length);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:780,height:360},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const cards=JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json',import.meta.url),'utf8'));
  await page.addInitScript(deck=>{
    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(data,...rest){
      if(data?.type==='start')data={...data,ranked:false,input:{...data.input,deck,firstPlayer:0,seed:10,difficulty:1,animationSpeed:'normal'}};
      return post.call(this,data,...rest);
    };
  },practiceDeck(createCatalog(cards),'mage'));
  await page.goto('http://127.0.0.1:'+server.address().port+'/ui-preview/');
  await page.getByRole('button',{name:'슬롯 1 선택',exact:true}).tap();
  await page.getByRole('button',{name:'대전',exact:true}).tap();
  await page.getByRole('button',{name:'마법사',exact:true}).tap();
  await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).tap();
  await page.locator('.mulligan-confirm').tap();
  const hand=page.locator('.folded-hand'),field=page.locator('.friendly-board');
  const turn=page.locator('.end-turn.your-turn');
  const friendly=field.locator('.battle-minion');
  await turn.waitFor();
  await hand.tap();
  const first=page.locator('.own-hand button[data-preview-card="recruit"]');
  await first.tap();
  await field.tap({position:{x:30,y:10}});
  await first.waitFor({state:'hidden'});
  const pointer=await context.newCDPSession(page);
  const drag=async(source,target)=>{
    const from=await source.boundingBox(),to=await target.boundingBox();
    assert.ok(from&&to);
    const a={x:Math.round(from.x+from.width/2),y:Math.round(from.y+from.height/2)};
    const b={x:Math.round(to.x+to.width/2),y:Math.round(to.y+to.height/2)};
    await pointer.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
    for(const i of [1,2,3,4,5]){
      await pointer.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:Math.round(a.x+(b.x-a.x)*i/5),y:Math.round(a.y+(b.y-a.y)*i/5)}]});
    }
    await pointer.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await hand.tap();
  await drag(first,field);
  const summon=page.locator('.battle-fx-layer[data-fx-kind="summon"][data-fx-side="own"]');
  await summon.waitFor();
  await turn.tap();
  await page.getByRole('button',{name:'예약 1개 취소'}).waitFor();
  await friendly.first().waitFor();
  await turn.waitFor({state:'hidden'});
  await turn.waitFor({timeout:35000});
  await hand.tap();
  const spell=page.locator('.own-hand button[data-preview-card="ice_shard"]');
  await spell.waitFor();
  const enemy=page.locator('.enemy-hero-zone .hero-portrait');
  const before=Number(await enemy.locator('.hero-health').textContent());
  await drag(spell,enemy);
  await page.locator('.battle-fx-layer[data-fx-kind="spell"][data-fx-side="own"]').waitFor();
  await page.waitForFunction(health=>Number(document.querySelector('.enemy-hero-zone .hero-health')?.textContent)<health,before);
  assert.equal(await hand.getAttribute('aria-expanded'),'false');
  await context.close();
});
