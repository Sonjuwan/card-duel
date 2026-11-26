import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {createCatalog,practiceDeck} from '../../../packages/engine/src/index.ts';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';

test('phone/tablet combat uses entire available height instead of three redundant header rows',{timeout:120000},async t=>{
  const server=createSoloAppServer(process.env.CARD_DUEL_GEOMETRY_BASELINE);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
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
    const faces=await page.locator('.arena-field .hero-portrait').evaluateAll(heroes=>heroes.map(hero=>{
      const frame=hero.getBoundingClientRect();
      const emblem=hero.querySelector('.hero-emblem');
      const art=emblem.getBoundingClientRect(),style=getComputedStyle(hero);
      return {
        left:art.left-(frame.left+parseFloat(style.borderLeftWidth)),
        right:art.right-(frame.right-parseFloat(style.borderRightWidth)),
        top:art.top-(frame.top+parseFloat(style.borderTopWidth)),
        bottom:art.bottom-(frame.bottom-parseFloat(style.borderBottomWidth)),
        radius:getComputedStyle(emblem).borderRadius===style.borderRadius,
        clipped:getComputedStyle(emblem).overflow==='hidden',
        fit:getComputedStyle(emblem.querySelector('.painted-art')).backgroundSize,
      };
    }));
    assert.equal(faces.length,2);
    for(const face of faces){
      assert.ok([face.left,face.right,face.top,face.bottom].every(value=>Math.abs(value)<1.5),JSON.stringify({label,face}));
      assert.ok(face.radius&&face.clipped&&parseFloat(face.fit)>100,JSON.stringify(face));
    }
    await page.screenshot({path:'ui-evidence/'+label+'-immersive-battle.png',fullPage:false});
    assert.deepEqual(errors,[],label+' no browser exceptions');
    await context.close();
  }
});

test('mobile fullscreen stays enter-only and dense combat fits seven units and ten cards',{timeout:120000},async t=>{
  const server=createSoloAppServer();
  server.prependListener('request',req=>{if(req.url?.startsWith('/ui-preview/'))req.url=req.url.slice('/ui-preview'.length);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:780,height:360},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  // Exercise the real worker/React path, then supply a display-only snapshot.
  // The injected snapshot is never sent to the worker or written to storage.
  await page.addInitScript(()=>{
    const replace=String.prototype.replace;
    window.logTranslations=null;
    String.prototype.replace=function(...args){
      if(window.logTranslations!==null&&String(this).startsWith('PERF_LOG_MARKER '))window.logTranslations++;
      return replace.apply(this,args);
    };
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker{
      set onmessage(handler){
        super.onmessage=event=>{
          const data=event.data;
          if(window.denseFixtureActive&&data?.type==='view')return;
          if(data?.type==='view'&&data.view?.state?.phase==='playing')window.denseBoard=(units=7,hand=10,classes,logLabel)=>{
            window.denseFixtureActive=true;
            const fixture=structuredClone(data),view=fixture.view.state;
            fixture.view.animation=undefined;
            view.revision+=1;
            if(logLabel)view.history=Array.from({length:60},(_,n)=>({turn:1,player:0,message:'PERF_LOG_MARKER '+logLabel+' '+n}));
            for(const [i,side] of [view.self,view.opponent].entries()){
              if(classes)side.heroClass=classes[i];
              side.board=Array.from({length:units},(_,j)=>({cardId:'wolf',instanceId:`fixture-${i}-${j}`,attack:12,health:18,maxHealth:18,attacksRemaining:1,keywords:j===0?['taunt','divineShield']:j===1?['stealth','windfury']:[]}));
              side.handCount=10;
            }
            view.self.handCount=hand;
            view.self.hand=Array.from({length:hand},(_,i)=>({cardId:'wolf',instanceId:'fixture-card-'+i}));
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
    assert.ok(share>=.38, String(share));
    assert.ok(await page.locator('.arena-field .hero-portrait').evaluateAll(heroes=>heroes.every(hero=>{
      const {width,height}=hero.getBoundingClientRect();
      return width>=height&&width/height<=1.35;
    })), 'combat hero frames are not squashed');
    const hand=page.locator('.folded-hand');
    const board=page.locator('.friendly-board');
    const before=await board.boundingBox();
    const compact=width!==1024;
    if(compact)await hand.tap();
    else assert.equal(await hand.isVisible(),false);
    const targets=await page.locator('.own-hand .battle-card').evaluateAll(cards=>cards.map(card=>{
      const rect=card.getBoundingClientRect();
      return card.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2));
    }));
    assert.equal(targets.length,10);
    const resourceGeometry=await page.evaluate(()=>{
      const rect=el=>el.getBoundingClientRect();
      const boxes=[...document.querySelectorAll('.battle-mana,.deck-pile,.folded-hand')].map(rect);
      const cards=[...document.querySelectorAll('.own-hand .battle-card')].map(rect);
      const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      return {cards:cards.every(card=>boxes.every(resource=>!overlap(card,resource))),
        stats:[...document.querySelectorAll('.battle-minion .minion-statline .stat')].every(el=>{
          const style=getComputedStyle(el);
          return style.borderRadius==='50%'&&parseFloat(style.fontSize)>=18&&style.backgroundColor!=='rgba(0, 0, 0, 0)';
        })};
    });
    assert.deepEqual(resourceGeometry,{cards:true,stats:true},String(width));
    const card=page.locator('.own-hand .battle-card').first();
    const original=await card.boundingBox();
    await card.tap({force:true});
    assert.deepEqual(await card.boundingBox(),original);
    assert.equal(await page.locator('.selected-card-use,.selection-cancel').count(),0);
    assert.ok(targets.every(Boolean),JSON.stringify({width,targets}));
    assert.deepEqual(await board.boundingBox(),before);
    await page.screenshot({path:`ui-evidence/dense-${width}.png`});
    await page.locator('.friendly-board').tap({position:{x:65,y:6}});
    if(compact)assert.equal(await hand.getAttribute('aria-expanded'),'false');
  }
  await page.setViewportSize({width:780,height:360});
  const classes=['warrior','shaman','rogue','paladin','hunter','druid','warlock','mage','priest'];
  const crops=new Map();
  for(let i=0;i<classes.length;i++){
    const pair=[classes[i],classes[(i+1)%classes.length]];
    await page.evaluate(pair=>window.denseBoard(7,10,pair),pair);
    for(const [index,zone] of ['self','enemy'].entries()){
      const art=page.locator(`.${zone}-hero-zone .hero-emblem .art-hero-${pair[index]}`);
      await art.waitFor();
      const style=await art.evaluate(el=>{
        const {backgroundImage,backgroundSize,backgroundPosition}=getComputedStyle(el);
        return {backgroundImage,backgroundSize,backgroundPosition};
      });
      assert.notEqual(style.backgroundImage,'none');
      assert.ok(parseFloat(style.backgroundSize)>100&&parseFloat(style.backgroundSize)<=135);
      const crop=style.backgroundSize+':'+style.backgroundPosition;
      if(crops.has(pair[index]))assert.equal(crops.get(pair[index]),crop,'both sides use the same class crop');
      crops.set(pair[index],crop);
      await page.locator(`.${zone}-hero-zone .hero-portrait`).screenshot({path:`ui-evidence/hero-crop-${zone}-${pair[index]}.png`});
    }
  }
  assert.equal(new Set(crops.values()).size,classes.length,'each class has its own focal point');
  await page.evaluate(()=>window.denseBoard(7,10,undefined,'first'));
  const report=page.locator('.battle-report textarea');
  await page.waitForFunction(()=>document.querySelector('.battle-report textarea')?.value.includes('PERF_LOG_MARKER first 59'));
  await page.evaluate(()=>{window.logTranslations=0;});
  for(let i=0;i<3;i++){
    await page.locator('.folded-hand').tap();
    await page.locator('.friendly-board').tap({position:{x:65,y:6}});
  }
  const translations=await page.evaluate(()=>{
    const value=window.logTranslations;
    window.logTranslations=null;
    return value;
  });
  t.diagnostic('Public log translations across three hand toggles: '+translations);
  assert.equal(translations,0,'hand UI must reuse the unchanged public history and report');
  assert.match(await report.inputValue(),/PERF_LOG_MARKER first 59/);
  await page.evaluate(()=>window.denseBoard(7,10,undefined,'updated'));
  await page.waitForFunction(()=>document.querySelector('.battle-report textarea')?.value.includes('PERF_LOG_MARKER updated 59'));
  const unitSizes=[];
  for(let count=1;count<=10;count++){
    await page.evaluate(count=>window.denseBoard(Math.min(7,count),count),count);
    await page.waitForFunction(count=>Number(document.querySelector('.own-hand .battle-hand')?.dataset.count)===count,count);
    await page.locator('.folded-hand').tap();
    const noOverlap=await page.evaluate(count=>{
      const cards=[...document.querySelectorAll('.own-hand .battle-card')];
      const mana=document.querySelector('.own-mana').getBoundingClientRect();
      const deck=document.querySelector('.arena-right .own-resources .deck-pile').getBoundingClientRect();
      const units=document.querySelectorAll('.friendly-board .battle-minion').length;
      return units===Math.min(7,count)&&cards.length===count&&cards.every(card=>{
        const r=card.getBoundingClientRect();
        return r.width>0&&[mana,deck].every(box=>r.right<=box.left||r.left>=box.right||r.bottom<=box.top||r.top>=box.bottom);
      });
    },count);
    assert.ok(noOverlap,`hand of ${count} stays outside mana and deck`);
    const units=await page.locator('.arena-field .battle-minion').evaluateAll(elements=>elements.map(element=>{
      const {width,height}=getComputedStyle(element);return [Number.parseFloat(width),Number.parseFloat(height)];
    }));
    if(count===1)unitSizes.push(units[0]);
    assert.ok(units.every(([width,height])=>Math.abs(width-unitSizes[0][0])<.1&&Math.abs(height-unitSizes[0][1])<.1),JSON.stringify({count,units,reference:unitSizes[0]}));
    await page.locator('.folded-hand').tap();
  }
  await context.close();
});


test('touch drag plays a minion and targeted spell while turn end waits in the queue',{timeout:90000},async t=>{
  const server=createSoloAppServer();
  server.prependListener('request',req=>{if(req.url?.startsWith('/ui-preview/'))req.url=req.url.slice('/ui-preview'.length);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:780,height:360},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const cards=JSON.parse(readFileSync(new URL('../../../data/cards/v0.23.0.json',import.meta.url),'utf8'));
  await page.addInitScript(deck=>{
    window.touchActions=[];
    window.dragHitReads=null;
    const elementFromPoint=document.elementFromPoint.bind(document);
    document.elementFromPoint=(x,y)=>{
      if(window.dragHitReads!==null)window.dragHitReads++;
      return elementFromPoint(x,y);
    };
    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(data,...rest){
      if(data?.type==='act')window.touchActions.push(data.action.type);
      if(data?.type==='start')data={...data,ranked:false,input:{...data.input,deck,firstPlayer:0,seed:10,difficulty:1,animationSpeed:'normal'}};
      return post.call(this,data,...rest);
    };
  },(()=>{
    const deck=practiceDeck(createCatalog(cards),'mage');
    return {...deck,cards:deck.cards.map(id=>id==='recruit'?'wisp':id)};
  })());
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
  const first=page.locator('.own-hand button[data-preview-card="wisp"]');
  const firstGeometry=await first.boundingBox();
  await first.tap();
  await page.locator('[data-hover-preview]').waitFor();
  assert.deepEqual(await first.boundingBox(),firstGeometry);
  await first.tap();
  await field.tap({position:{x:30,y:10}});
  await first.waitFor({state:'hidden'});
  await page.locator('[data-hover-preview]').waitFor({state:'detached'});
  const pointer=await context.newCDPSession(page);
  const drag=async(source,target,beforeRelease)=>{
    const from=await source.boundingBox(),to=await target.boundingBox();
    assert.ok(from&&to);
    const a={x:Math.round(from.x+from.width/2),y:Math.round(from.y+from.height/2)};
    const b={x:Math.round(to.x+to.width/2),y:Math.round(to.y+to.height/2)};
    await pointer.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
    for(const i of [1,2,3,4,5]){
      await pointer.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:Math.round(a.x+(b.x-a.x)*i/5),y:Math.round(a.y+(b.y-a.y)*i/5)}]});
    }
    if(beforeRelease)await beforeRelease();
    await pointer.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await hand.tap();
  const enemyBoard=page.locator('.enemy-board');
  await page.evaluate(()=>{window.dragHitReads=0;});
  await drag(first,enemyBoard,async()=>{
    const reads=await page.evaluate(()=>{
      const count=window.dragHitReads;
      window.dragHitReads=null;
      return count;
    });
    assert.ok(reads>0&&reads<=5,'each delivered drag move needs at most one hit test');
    t.diagnostic('Hit tests across five minion drag moves: '+reads);
  });
  const summon=page.locator('.battle-fx-layer[data-fx-kind="summon"][data-fx-side="own"]');
  await summon.waitFor();
  assert.equal(await hand.getAttribute('aria-expanded'),'true');
  const pending=page.locator('.own-hand button[data-preview-card="mana_wyrm"]');
  await pending.waitFor();
  await drag(pending,enemyBoard,async()=>{
    await friendly.first().waitFor();
    assert.equal(await page.locator('.duel-screen').evaluate(el=>el.classList.contains('is-dragging')),true);
  });
  await pending.waitFor({state:'detached'});
  assert.match(await page.locator('.own-resources .mana-number').textContent(),/^0\//);
  await page.waitForTimeout(300);
  await turn.evaluate(button=>button.click());
  await page.waitForFunction(()=>window.touchActions.at(-1)==='endTurn');
  assert.deepEqual(await page.evaluate(()=>window.touchActions.slice(1,4)),['playCard','playCard','endTurn']);
  await turn.waitFor({state:'hidden'});
  await turn.waitFor({timeout:35000});
  await hand.tap();
  const spell=page.locator('.own-hand button[data-preview-card="ice_shard"]');
  await spell.waitFor();
  const enemy=page.locator('.enemy-hero-zone .hero-portrait');
  const before=Number(await enemy.locator('.hero-health').textContent());
  await drag(spell,enemy,async()=>{
    await page.locator('.spell-cast-anchor').waitFor();
    assert.equal(await page.locator('.touch-drag-ghost').count(),0);
    await page.locator('.aim-overlay line[visibility="visible"]').waitFor({state:'attached'});
  });
  await page.locator('.battle-fx-layer[data-fx-kind="spell"][data-fx-side="own"]').waitFor();
  await page.waitForFunction(health=>Number(document.querySelector('.enemy-hero-zone .hero-health')?.textContent)<health,before);
  assert.equal(await hand.getAttribute('aria-expanded'),await page.locator('.own-hand .battle-card').count()>0?'true':'false');
  const rail=page.locator('.impact-rail');
  await rail.locator('.impact-icon').nth(4).waitFor();
  assert.ok(await rail.evaluate(el=>el.scrollHeight>el.clientHeight));
  assert.ok(await rail.locator('.impact-icon').evaluateAll(buttons=>buttons.every(button=>{
    const portrait=button.querySelector('.impact-portrait'),mark=button.querySelector('.impact-kind');
    if(!portrait||!mark)return true;
    const a=portrait.getBoundingClientRect(),b=mark.getBoundingClientRect();
    return a.width>0&&b.width>0&&a.right<=b.left+.5;
  })), 'action glyphs have their own column');
  await page.screenshot({path:'ui-evidence/phone-action-rail.png'});
  await rail.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await page.getByRole('button',{name:'최신 행동으로 이동'}).click();
  await page.waitForFunction(()=>document.querySelector('.impact-rail').scrollTop===0);
  await context.close();
});

test('real worker queues two attacks while a staged battlecry validates its targets',{timeout:90000},async t=>{
  const profileCombat=process.env.CARD_DUEL_PROFILE_COMBAT==='1';
  const profileDragWrites=process.env.CARD_DUEL_PROFILE_DRAG_WRITES==='1';
  const server=createSoloAppServer(process.env.CARD_DUEL_SOLO_APP_DIST_DIR);
  server.prependListener('request',req=>{if(req.url?.startsWith('/ui-preview/'))req.url=req.url.slice('/ui-preview'.length);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:780,height:360},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    window.combatActions=[];
    window.combatAnchorLookups={all:0,scanned:0,exact:0};
    window.combatArenaReads={friendlyBoard:0};
    const box=Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect=function(){
      if(this.classList.contains('friendly-board'))window.combatArenaReads.friendlyBoard++;
      return box.call(this);
    };

    const all=Element.prototype.querySelectorAll,one=Element.prototype.querySelector;
    Element.prototype.querySelectorAll=function(selector){
      const result=all.call(this,selector);
      if(selector==='[data-preview-minion]'){
        window.combatAnchorLookups.all++;
        window.combatAnchorLookups.scanned+=result.length;
      }
      return result;
    };
    Element.prototype.querySelector=function(selector){
      if(selector.startsWith('[data-preview-minion="'))window.combatAnchorLookups.exact++;
      return one.call(this,selector);
    };

    const post=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(data,...args){
      if(data?.type==='act')window.combatActions.push(data.action);
      if(data?.type==='start')data={...data,ranked:false,input:{...data.input,firstPlayer:0,seed:10,animationSpeed:'normal'}};
      return post.call(this,data,...args);
    };
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/ui-preview/');
  await page.getByRole('button',{name:'슬롯 1 선택',exact:true}).tap();
  await page.getByRole('button',{name:'대전',exact:true}).tap();
  await page.getByRole('button',{name:'전사',exact:true}).tap();
  await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).tap();
  await page.locator('.mulligan-confirm').tap();
  await page.locator('.end-turn.your-turn').waitFor();
  await page.getByRole('button',{name:'전투 설정'}).tap();
  await page.getByRole('button',{name:'저장 후 나가기'}).tap();
  await page.locator('.end-turn').waitFor({state:'detached'});
  await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{
      const open=indexedDB.open('card-duel-solo-saves-v1-ui-preview',2);
      open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
    });
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('matches','readwrite'),store=tx.objectStore('matches'),all=store.getAll();
        all.onsuccess=()=>{
          const row=all.result[0],{snapshot}=row,{state}=snapshot;
          const unit=(cardId,instanceId,attack,health,attacksRemaining,keywords=[])=>({cardId,instanceId,attack,health,maxHealth:health,attacksRemaining,keywords,summonedTurn:0});
          const [own,enemy]=state.players;
          own.board=[unit('wind_farseer','test-wind',3,3,2,['windfury']),unit('wolf','test-wolf',2,4,1)];
          enemy.board=[unit('wolf','test-enemy',2,5,0)];
          own.hand=[{cardId:'harsh_overseer',instanceId:'test-battlecry'},{cardId:'ice_shard',instanceId:'test-spell'},{cardId:'silver_protector',instanceId:'shield-card'},{cardId:'nature_choice',instanceId:'wrath-3'},{cardId:'nature_choice',instanceId:'wrath-1'}];
          own.mana=10;own.maxMana=10;
          store.put(row);
        };
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
    }finally{db.close();}
  });
  const resume=page.getByRole('button',{name:'이어서 플레이하기'});
  if(!await resume.isVisible())await page.getByRole('button',{name:'대전',exact:true}).tap();
  await resume.tap();
  const wind=page.locator('[data-preview-minion="test-wind"]'),wolf=page.locator('[data-preview-minion="test-wolf"]');
  const enemyHero=page.locator('.enemy-hero-zone .hero-portrait');
  const enemyUnit=page.locator('[data-preview-minion="test-enemy"]');
  const ownBoard=page.locator('.friendly-board');
  await wind.waitFor();
  const cdp=await context.newCDPSession(page);
  const center=async locator=>{
    await locator.waitFor({state:'visible'});
    const box=await locator.boundingBox();
    assert.ok(box);
    return {x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)};
  };
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const drag=async(source,destination,whileDragging)=>{
    const a=await center(source),b=await center(destination);
    await touch('touchStart',[a]);
    for(let step=1;step<=5;step++)await touch('touchMove',[{x:Math.round(a.x+(b.x-a.x)*step/5),y:Math.round(a.y+(b.y-a.y)*step/5)}]);
    await whileDragging?.();
    await touch('touchEnd',[]);
  };
  if(profileDragWrites)await page.evaluate(()=>{
    // Diagnostic counters only: run separately from timing comparisons.
    const props=new Set(['--touch-x','--touch-y','--cast-x','--cast-top']);
    const counts=Object.fromEntries([...props].map(name=>[name,{writes:0,identical:0}]));
    const previous=new WeakMap();
    const proto=CSSStyleDeclaration.prototype,original=proto.setProperty;
    let pointerMoves=0;
    const onMove=()=>{pointerMoves++;};
    document.addEventListener('pointermove',onMove,{capture:true,passive:true});
    proto.setProperty=function(name,value,priority){
      if(props.has(name)){
        let values=previous.get(this);
        if(!values){values=new Map();previous.set(this,values);}
        const prior=values.get(name);
        counts[name].writes++;
        if(prior&&prior.value===value&&prior.priority===priority)counts[name].identical++;
        values.set(name,{value,priority});
      }
      return original.call(this,name,value,priority);
    };
    window.stopDragWriteProfile=()=>{
      document.removeEventListener('pointermove',onMove,true);
      proto.setProperty=original;
      return {pointerMoves,properties:counts};
    };
  });
  await enemyUnit.tap({force:true});
  const pinned=page.locator('[data-hover-preview]');
  await pinned.waitFor();
  await page.waitForTimeout(1200);
  assert.equal(await pinned.isVisible(),true,'touch inspection must survive pointer release');
  await page.locator('.battle-divider').tap({force:true});
  await pinned.waitFor({state:'detached'});
  if(profileCombat){
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await page.evaluate(()=>{
      const start=performance.now();
      const intervals=[];
      let prior,frame;
      const tick=now=>{
        if(prior!==undefined)intervals.push(now-prior);
        prior=now;frame=requestAnimationFrame(tick);
      };
      frame=requestAnimationFrame(tick);
      window.stopCombatProfile=()=>{
        cancelAnimationFrame(frame);
        const long=performance.getEntriesByType('long-animation-frame')
          .filter(entry=>entry.startTime>=start);
        const layout=new Map();
        for(const script of long.flatMap(entry=>entry.scripts)){
          if(!script.forcedStyleAndLayoutDuration)continue;
          const key=`${script.invoker} @ ${script.sourceURL?new URL(script.sourceURL,location.href).pathname:'inline'}:${script.sourceCharPosition}`;
          layout.set(key,(layout.get(key)??0)+script.forcedStyleAndLayoutDuration);
        }
        const sorted=intervals.sort((a,b)=>a-b);
        const percentile=p=>sorted[Math.ceil(sorted.length*p)-1];
        return {samples:sorted.length,p95:percentile(.95),p99:percentile(.99),longFrames:long.length,
          longest:Math.max(0,...long.map(entry=>entry.duration)),
          forcedLayout:[...layout.values()].reduce((sum,elapsed)=>sum+elapsed,0),
          layoutSources:[...layout].sort((a,b)=>b[1]-a[1]).slice(0,5)};
      };
    });
  }
  await drag(wind,enemyHero);
  assert.equal(await wind.evaluate(unit=>unit.classList.contains('is-ready')),true);
  await drag(wind,enemyHero);
  assert.equal(await wind.evaluate(unit=>unit.classList.contains('is-ready')),false);
  await drag(wolf,enemyHero);
  assert.equal(await wolf.evaluate(unit=>unit.classList.contains('is-ready')),false);
  // Throttled input can take long enough for the queued attack to begin.
  if(!profileCombat)assert.equal(await wolf.evaluate(unit=>unit.classList.contains('is-preparing')),true);
  const hand=page.locator('.folded-hand'),card=page.locator('[data-preview-card="harsh_overseer"].battle-card');
  await hand.tap();
  await drag(card,page.locator('.enemy-board'));
  const anchor=page.locator('.battlecry-anchor');
  await anchor.waitFor();
  assert.deepEqual(await ownBoard.locator('.battle-minion').count(),2);
  assert.equal(await enemyHero.evaluate(el=>el.classList.contains('is-targeted')),false);
  assert.ok(await enemyUnit.evaluate(el=>el.classList.contains('is-targeted')));
  assert.ok(await wolf.evaluate(el=>el.classList.contains('is-targeted')));
  await drag(anchor,enemyHero);
  await anchor.waitFor({state:'detached'});
  assert.equal(await page.locator('.own-hand').getAttribute('data-hand-open'),'true');
  await drag(card,page.locator('.enemy-board'));
  await anchor.waitFor();
  await drag(anchor,enemyUnit,()=>page.locator('.aim-overlay line[visibility="visible"]').waitFor({state:'attached'}));
  await card.waitFor({state:'detached'});
  await page.waitForFunction(()=>window.combatActions.some(action=>action.instanceId==='test-battlecry'&&action.target?.instanceId==='test-enemy'));
  await page.waitForFunction(()=>document.querySelector('[data-preview-minion="test-enemy"] .stat-health')?.textContent==='4');
  assert.equal(await enemyUnit.locator('.stat-attack').textContent(),'4');
  assert.equal(await ownBoard.locator('.battle-minion').count(),3);
  assert.equal(await page.evaluate(()=>window.combatActions.filter(action=>action.type==='attack').length),3);
  assert.equal(await page.evaluate(()=>window.combatActions.filter(action=>action.instanceId==='test-battlecry').length),1);
  await drag(page.locator('.own-hand [data-preview-card="ice_shard"]'),enemyHero);
  await page.waitForFunction(()=>window.combatActions.some(action=>action.instanceId==='test-spell'&&action.target?.kind==='hero'));
  const shieldCard=page.locator('[data-action-source="card:shield-card"]');
  await drag(shieldCard,page.locator('.enemy-board'));
  await anchor.waitFor();
  await drag(anchor,wolf);
  await page.waitForFunction(()=>document.querySelector('[data-preview-minion="test-wolf"]')?.classList.contains('has-shield'));
  const chosenSpell=page.getByRole('button',{name:'주문 대상 지정',exact:true});
  for(const [index,id] of ['wrath-3','wrath-1'].entries()){
    await drag(page.locator(`[data-action-source="card:${id}"]`),page.locator('.enemy-board'));
    const choice=page.getByRole('dialog',{name:'카드 효과 선택'});
    await choice.getByRole('button',{name:index===0?'피해 3':'피해 1 + 드로우',exact:true}).tap();
    await chosenSpell.waitFor();
    await drag(chosenSpell,enemyUnit);
    await page.waitForFunction(({id,index})=>window.combatActions.some(action=>action.instanceId===id&&action.choice===index),{id,index});
  }
  await page.waitForFunction(()=>!document.querySelector('[data-preview-minion="test-enemy"]'));
  assert.equal(await page.locator('.own-hand .battle-card').count(),1);
  if(profileDragWrites)t.diagnostic('Drag style write counts (not frame timings): '+JSON.stringify(await page.evaluate(()=>window.stopDragWriteProfile())));
  const lookups=await page.evaluate(()=>window.combatAnchorLookups);
  t.diagnostic('Combat DOM anchor queries: '+JSON.stringify(lookups));
  if(profileCombat)t.diagnostic('Active combat CPU 4x: '+JSON.stringify(await page.evaluate(()=>({...window.stopCombatProfile(),arenaReads:window.combatArenaReads}))));


  await context.close();
});
