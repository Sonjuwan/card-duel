import {chooseBasicDeck,openLegacyPlayOptions} from './deck-selection-browser.ts';
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
    ['phone-640',640,360,true],
    ['phone-844',844,390,true],
    ['phone-932',932,430,true],
    ['phone-780',780,360,true],
    ['tablet-1024',1024,768,true],
    ['desktop-1366',1366,768,false],
    ['desktop-1920',1920,1080,false],
  ]){
    const context=await browser.newContext({viewport:{width,height},isMobile,hasTouch:isMobile,deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',err=>errors.push(err.message));
    await page.goto('http://127.0.0.1:'+addr.port+'/');
    await openLegacyPlayOptions(page);
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
      const arena=rect(base+'>.battle-arena'),main=rect('.game-main'),button=rect('.compact-settings-trigger'),turn=rect('.end-turn');
      return {
        viewportWidth:innerWidth,viewportHeight:innerHeight,
        documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,
        headerDisplay:style('.game-main>.app-header').display,
        titlePosition:style(title).position,
        messagePosition:style(message).position,
        boardHeight:rect('.enemy-board').height+rect('.friendly-board').height,arenaTop:arena?.top,arenaHeight:arena?.height,mainTop:main?.top,mainHeight:main?.height,
        settingsTouch:button?.height??0,endTurnTouch:turn?.height??0,
        statusVisible:style(message+'>span:nth-child(2)').clipPath,
      };
    });
    t.diagnostic(label+' board rows '+result.boardHeight.toFixed(1)+'px / '+height+'px');
    assert.equal(result.headerDisplay,'none',label+' hides brand/header');
    assert.equal(result.titlePosition,'absolute',label+' title floating');
    assert.equal(result.messagePosition,'absolute',label+' hint floating');
    assert.ok(result.arenaHeight>=result.viewportHeight*.79,label+' battle should receive most viewport '+JSON.stringify(result));
    assert.ok(result.arenaTop<=result.viewportHeight*.09,label+' no three bars above the board '+JSON.stringify(result));
    assert.ok(result.settingsTouch>=36,label+' settings accessible');
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
          if(data?.type==='view'&&data.view?.state?.phase==='playing')window.denseBoard=(units=7,hand=10,classes,logLabel,wideStats=false)=>{
            window.denseFixtureActive=true;
            const fixture=structuredClone(data),view=fixture.view.state;
            fixture.view.animation=undefined;
            view.revision+=1;
            if(logLabel)view.history=Array.from({length:60},(_,n)=>({turn:1,player:0,message:'PERF_LOG_MARKER '+logLabel+' '+n}));
            for(const [i,side] of [view.self,view.opponent].entries()){
              if(classes)side.heroClass=classes[i];
              side.board=Array.from({length:units},(_,j)=>({cardId:'wolf',instanceId:`fixture-${i}-${j}`,attack:12,health:18,maxHealth:18,attacksRemaining:1,keywords:j===0?['taunt','divineShield']:j===1?['stealth','windfury']:[]}));
              side.handCount=hand;
            side.mana=side.maxMana=10;
            }
            view.self.handCount=hand;
            view.self.hand=Array.from({length:hand},(_,i)=>({cardId:i===0?'spellbender':i===1&&wideStats?'deathwing':'wolf',instanceId:'fixture-card-'+i}));
            handler.call(this,new MessageEvent('message',{data:fixture}));
          };
          handler?.call(this,event);
        };
      }
    };
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/ui-preview/');
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
  await chooseBasicDeck(page,'전사');
  await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).tap();
  if(enteredFullscreen)assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);
  t.diagnostic(enteredFullscreen?'Chromium Fullscreen API entered and persisted':'Chromium showed manual rotation guidance');
  const mulliganCard=page.locator('.mulligan-cards .battle-card').first();
  await mulliganCard.locator('.card-copy').waitFor();
  await page.locator('.mulligan-confirm').tap();
  await page.waitForFunction(()=>Boolean(window.denseBoard));
  await page.evaluate(()=>window.denseBoard());
  await page.locator('.enemy-board .battle-minion').nth(6).waitFor();
  await page.locator('.friendly-board .battle-minion').nth(6).waitFor();
  await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
  await metrics.detach();
  for(const [width,height] of [[640,360],[780,360],[844,390],[932,430],[1024,768],[1366,768]]){
    await page.setViewportSize({width,height});
    const dimensions=await page.evaluate(()=>{
      const box=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
      const rows=['.enemy-board','.friendly-board'].map(selector=>{
        const row=box(selector),units=[...document.querySelectorAll(selector+' .battle-minion')].map(el=>el.getBoundingClientRect().toJSON());
        return {row,units};
      });
      return {rows,arena:box('.arena-field'),zones:['.enemy-hero-zone','.enemy-board','.friendly-board','.self-hero-zone'].map(box),width:innerWidth,height:innerHeight,
        scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
        rail:getComputedStyle(document.querySelector('.arena-right')).display};
    });
    assert.equal(dimensions.rail,height>540?'grid':'contents');
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
    assert.ok(share>=(height<=540?.38:.34), String(share));
    if(height>540){
      assert.ok(Math.abs(dimensions.zones[0].height-dimensions.zones[3].height)<1);
      assert.ok(Math.abs(dimensions.zones[1].height-dimensions.zones[2].height)<1);
    }
    if(height<=540)for(const [index,zone] of dimensions.zones.entries()){
      assert.ok(Math.abs(zone.height-dimensions.arena.height/4)<1.5,JSON.stringify({width,index,zone}));
      assert.ok(Math.abs(zone.top-dimensions.arena.top-index*zone.height)<1.5,JSON.stringify({width,index,zone}));
    }
    assert.ok(await page.locator('.arena-field .hero-portrait').evaluateAll(heroes=>heroes.every(hero=>{
      const {width,height}=hero.getBoundingClientRect();
      return width>=height&&width/height<=1.35;
    })), 'combat hero frames are not squashed');
    const hand=page.locator('.folded-hand');
    const board=page.locator('.friendly-board');
    const before=await board.boundingBox();
    const compact=height<=540;
    if(compact){
      assert.equal(await hand.locator('.folded-cards .painted-art').count(),3);
      const rail=await page.evaluate(()=>{
        const rect=selector=>document.querySelector(selector).getBoundingClientRect();
        return {
          enemyHand:rect('.arena-field > .hidden-hand').toJSON(),
          ownHand:rect('.own-hand .folded-hand').toJSON(),
          enemyMana:rect('.enemy-mana').toJSON(),
          ownMana:rect('.own-mana').toJSON(),
        };
      });
      assert.ok(Object.values(rail).every(box=>box.x>width/2),JSON.stringify(rail));
      assert.ok(rail.enemyHand.bottom<=rail.enemyMana.top+1&&rail.ownMana.bottom<=rail.ownHand.top+1,JSON.stringify(rail));
      await hand.tap();
    }
    else assert.equal(await hand.isVisible(),false);
    const targets=await page.locator('.own-hand .battle-card').evaluateAll(cards=>cards.map(card=>{
      const rect=card.getBoundingClientRect(),y=rect.y+rect.height/2;
      for(const fraction of [.5,.2,.12,.75]){
        const x=rect.x+rect.width*fraction;
        if(card.contains(document.elementFromPoint(x,y)))return {x,y};
      }
      return null;
    }));
    assert.equal(targets.length,10);
    const resourceGeometry=await page.evaluate(()=>{
      const rect=el=>el.getBoundingClientRect();
      const boxes=[...document.querySelectorAll('.battle-mana,.deck-pile,.folded-hand')].filter(el=>el.getClientRects().length).map(rect);
      const cards=[...document.querySelectorAll('.own-hand .battle-card')].map(rect);
      const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      const settings=rect(document.querySelector('.compact-settings-trigger'));
      const opponentInfo=[...document.querySelectorAll('.hidden-hand .hand-count,.enemy-mana .mana-display')];
      return {cards:cards.every(card=>boxes.every(resource=>!overlap(card,resource))),
        opponentInfo:opponentInfo.length===2&&opponentInfo.every(el=>rect(el).width>0&&!overlap(rect(el),settings)),
        stats:[...document.querySelectorAll('.battle-minion .minion-statline .stat')].every(el=>{
          const style=getComputedStyle(el);
          return style.borderRadius==='50%'&&parseFloat(style.fontSize)>=18&&style.backgroundColor!=='rgba(0, 0, 0, 0)';
        })};
    });
    assert.deepEqual(resourceGeometry,{cards:true,opponentInfo:true,stats:true},String(width));
    assert.ok(await page.locator('.arena-field .minion-statline').evaluateAll(rows=>rows.every(row=>{
      const unit=row.closest('.battle-minion').getBoundingClientRect();
      const [attack,health]=[...row.querySelectorAll('.stat')].map(node=>node.getBoundingClientRect());
      return attack.left>=unit.left&&health.right<=unit.right&&attack.right<=health.left;
    })),width+'px minion stats do not overhang adjacent units');
    if(!compact){
      const alignment=await page.evaluate(()=>{
        const rect=selector=>document.querySelector(selector).getBoundingClientRect();
        const center=box=>box.x+box.width/2;
        const hero=rect('.self-hero-zone .hero-portrait');
        const enemy=rect('.enemy-hero-zone .hero-portrait');
        const hand=rect('.own-hand .battle-hand');
        const away=rect('.arena-field > .hidden-hand');
        const mana=['.enemy-mana .mana-display','.own-mana .mana-display'].map(rect);
        const decks=['.opponent-resources .deck-pile','.arena-right .own-resources .deck-pile'].map(rect);
        const weapons=['.enemy-hero-zone .weapon-slot','.self-hero-zone .weapon-slot'].map(rect);
        const powers=['.enemy-hero-zone .hero-power','.self-hero-zone .hero-power'].map(rect);
        const turn=rect('.turn-control');
        const rail=rect('.arena-left');
        const field=rect('.arena-field');
        const divider=rect('.divider-emblem');
        const decor=rect('.table-decor');
        const midY=box=>box.top+box.height/2;
        const mirror=([upper,lower],center=divider)=>Math.abs(midY(upper)+midY(lower)-2*midY(center));
        return {
          axis:[hero,enemy,hand,away,divider,decor].map(box=>Math.abs(center(box)-center(field))),
          position:[mirror([enemy,hero]),mirror(decks),mirror(weapons),mirror(powers),mirror(mana,field),Math.abs(midY(divider)-midY(turn))],
          columns:[decks,weapons,powers,mana,[decks[0],turn]].map(([a,b])=>Math.abs(center(a)-center(b))),
          manaSize:[Math.abs(mana[0].width-mana[1].width),Math.abs(mana[0].height-mana[1].height)],
          crystals:document.querySelectorAll('.battle-mana .mana-crystal').length,
          log:rail.width>=32,insideMana:mana[0].top>=0&&mana[1].bottom<=innerHeight
        };
      });
      assert.ok([...alignment.axis,...alignment.position,...alignment.columns,...alignment.manaSize].every(delta=>delta<2)&&
        alignment.crystals===20&&alignment.log&&alignment.insideMana,JSON.stringify({width,...alignment}));
    }
    const card=page.locator('.own-hand .battle-card').first();
    const copy=card.locator('.card-copy');
    assert.equal(await copy.isVisible(),!compact);
    if(compact){
      assert.equal(await card.locator('.card-copy,.card-rarity-anchor,.card-tribe').count(),0);
      assert.equal(await page.locator('.own-hand .battle-hand [data-compact-hand]').count(),10);
      assert.equal(await page.locator('.folded-cards .compact-hand-thumbnail').count(),3);
    }
    const geometry=await card.evaluate(el=>{
      const art=el.querySelector('.card-art'),mana=el.querySelector('.card-mana');
      const box=art.getBoundingClientRect(),badge=mana.getBoundingClientRect();
      const style=getComputedStyle(el);
      const content=parseFloat(style.width)-['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth']
        .reduce((sum,key)=>sum+parseFloat(style[key]),0);
      return {fillsWidth:Math.abs(box.width-content)<1,
        badgeOverArt:badge.top<box.bottom&&badge.bottom>box.top&&badge.left<box.right&&badge.right>box.left,
        badgePosition:getComputedStyle(mana).position};
    });
    assert.deepEqual(geometry,{fillsWidth:true,badgeOverArt:true,badgePosition:'absolute'});
    if(!compact){
      assert.ok(await copy.evaluate(el=>{
        const oldHeight=el.clientHeight;
        if(el.scrollHeight<=oldHeight)return true;
        el.scrollTop=el.scrollHeight;
        const reachedEnd=el.scrollHeight-el.scrollTop-oldHeight<=1;
        el.scrollTop=0;
        return reachedEnd&&el.clientHeight===oldHeight;
      }),'the longest description scrolls to its last line without resizing');
    }
    await page.screenshot({path:`ui-evidence/dense-${width}-hand.png`});
    const original=await card.boundingBox();
    assert.ok(original);
    assert.ok(targets.every(Boolean),JSON.stringify({width,targets}));
    const description=await card.getAttribute('aria-description');
    await page.touchscreen.tap(targets[0].x,targets[0].y);
    const detail=page.locator('[data-hover-preview]');
    await detail.locator('.hover-description').filter({hasText:description}).waitFor({timeout:4000});
    assert.equal(await detail.locator('.hover-description').textContent(),description);
    assert.ok(await detail.locator('.hover-large-card .card-copy').isVisible());
    assert.deepEqual(await card.boundingBox(),original);
    assert.equal(await page.locator('.selected-card-use,.selection-cancel').count(),0);
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
  assert.equal(await page.locator('.battle-report textarea').count(),0);
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
  assert.equal(translations,0,'hand UI must not build the removed record panes');
  for(const [width,height] of [[640,360],[780,360],[1024,768],[1366,768]]){
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:'reduce'});
    const compact=height<=540;
    let unitSize;
    let tribeSize;
    for(let count=0;count<=10;count++){
      await page.evaluate(count=>window.denseBoard(Math.min(7,count),count,undefined,undefined,count===10),count);
      await page.waitForFunction(count=>Number(document.querySelector('.own-hand .battle-hand')?.dataset.count)===count,count);
      if(compact&&count)await page.locator('.folded-hand').tap();
      const geometry=await page.evaluate(compact=>{
        const rect=el=>el.getBoundingClientRect();
        const cards=[...document.querySelectorAll('.own-hand .battle-card')];
        const hand=rect(document.querySelector('.card-back-row'));
        const axis=box=>(box.left+box.right)/2;
        const field=axis(rect(document.querySelector('.arena-field')));
        const resources=['.own-mana','.arena-right .own-resources .deck-pile','.self-hero-zone .hero-portrait'].map(selector=>rect(document.querySelector(selector)));
        const overlaps=(r,b)=>r.right>b.left+.5&&r.left<b.right-.5&&r.bottom>b.top+.5&&r.top<b.bottom-.5;
        const units=['.friendly-board','.enemy-board'].map(selector=>[...document.querySelectorAll(selector+' .battle-minion')]);
        const tribe=cards.map(card=>{
          const badge=card.querySelector('.card-tribe');
          if(!badge)return null;
          const row=rect(badge.parentElement),box=rect(badge);
          const [attack,hp]=[...badge.parentElement.querySelectorAll('.stat')].map(rect);
          return {center:Math.abs(axis(row)-axis(box)),clear:!overlaps(box,attack)&&!overlaps(box,hp),size:parseFloat(getComputedStyle(badge).fontSize)};
        }).filter(Boolean);
        const frames=units.flat().map(node=>{
          const frame=rect(node);
          const art=node.querySelector('.minion-medallion');
          const image=art.querySelector('.original-art .painted-art');
          const box=rect(image),style=getComputedStyle(node),mask=getComputedStyle(art);
          const border=side=>parseFloat(style['border'+side+'Width'])+parseFloat(mask['border'+side+'Width']);
          return {fit:getComputedStyle(image).backgroundSize,clipped:mask.overflow==='hidden',
            radius:mask.borderRadius===style.borderRadius,
            edge:[box.left-frame.left-border('Left'),frame.right-box.right-border('Right'),
              box.top-frame.top-border('Top'),frame.bottom-box.bottom-border('Bottom')]};
        });
        const digits=[...document.querySelectorAll('.own-hand .battle-hand .stat[data-wide-stat]')].map(stat=>{
          const range=document.createRange();
          range.selectNodeContents(stat);
          const ink=range.getBoundingClientRect(),box=rect(stat),style=getComputedStyle(stat);
          return [stat.textContent,ink.left-box.left-parseFloat(style.borderLeftWidth),box.right-ink.right-parseFloat(style.borderRightWidth)];
        });
        return {frames,tribe,digits,own:cards.length,opponent:document.querySelectorAll('.opponent-card-slot').length,
          handCenter:!compact&&hand.width?Math.abs(axis(hand)-field):0,
          cardCenter:!compact&&cards.length?Math.abs((rect(cards[0]).left+rect(cards.at(-1)).right)/2-field):0,
          clear:cards.every(card=>rect(card).width>0&&resources.slice(0,compact?2:3).every(box=>!overlaps(rect(card),box))),
          emptySlot:Math.abs(axis(rect(document.querySelector('[data-drop-position="0"]')))-field),
          rows:units.map(row=>({sizes:row.map(unit=>{const r=rect(unit);return [r.width,r.height];}),
            center:row.length?Math.abs((rect(row[0]).left+rect(row.at(-1)).right)/2-field):0}))};
      },compact);
      const {frames,tribe,rows}=geometry;
      assert.equal(geometry.own,count);
      assert.equal(geometry.opponent,count);
      if(count===10){
        assert.equal(geometry.digits.length,2);
        assert.ok(geometry.digits.every(([value,left,right])=>value==='12'&&left>-.5&&right>-.5),JSON.stringify({width,...geometry.digits}));
      }
      assert.ok(geometry.clear&&geometry.handCenter<1&&geometry.cardCenter<1,JSON.stringify({width,count,geometry}));
      if(!count)assert.ok(geometry.emptySlot<2,JSON.stringify({width,geometry}));
      for(const row of rows){
        assert.equal(row.sizes.length,Math.min(count,7));
        assert.ok(row.center<1,JSON.stringify({width,count,row}));
        if(count===1)unitSize??=row.sizes[0];
        assert.ok(row.sizes.every(([w,h])=>Math.abs(w-unitSize[0])<.1&&Math.abs(h-unitSize[1])<.1),JSON.stringify({width,count,row,unitSize}));
      }
      for(const frame of frames)assert.ok(frame.fit==='cover'&&frame.clipped&&frame.radius&&frame.edge.every(edge=>Math.abs(edge)<1.5),JSON.stringify(frame));
      for(const badge of tribe)assert.ok(badge.clear&&badge.center<1&&badge.size>=7.5,JSON.stringify({width,count,badge}));
      if(tribe.length)tribeSize=tribe[0].size;
      if(compact&&count)await page.locator('.folded-hand').tap();
    }
    t.diagnostic(width+'px board groups and hands checked at every count; unit '+unitSize.join(' × ')+' px'+(tribeSize?'; tribe '+tribeSize+' px':''));
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{
    window.reflowCalls=[];
    const animate=Element.prototype.animate;
    Element.prototype.animate=function(frames,options){
      if(this.matches('.battle-minion')&&frames[0]?.translate)window.reflowCalls.push([this.dataset.previewMinion,frames[0].translate,options.duration]);
      return animate.call(this,frames,options);
    };
    window.denseBoard(2,5);
  });
  await page.waitForTimeout(220);
  for(const count of [3,2]){
    await page.evaluate(count=>{window.reflowCalls=[];window.denseBoard(count,5);},count);
    await page.waitForFunction(()=>window.reflowCalls.length===4);
    await page.waitForFunction(()=>[...document.querySelectorAll('.battle-minion')].every(el=>getComputedStyle(el).translate==='none'));
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
  await page.getByRole('button',{name:'대전',exact:true}).tap();
  await chooseBasicDeck(page,'마법사');
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
  const obscured=page.locator('.own-hand[data-hand-obscured=true]');
  const mana=page.locator('.own-mana .mana-number');
  const liveHand=page.locator('.battle-hand');
  const currentHand=()=>liveHand.locator('.battle-card').evaluateAll(cards=>cards.map(card=>card.dataset.actionSource));
  const beforeCancelled=await currentHand(),manaBeforeCancelled=await mana.textContent();
  const grip=await first.locator('.card-mana').boundingBox(),row=await field.boundingBox();
  assert.ok(grip&&row);
  const start={x:Math.round(grip.x+grip.width/2),y:Math.round(grip.y+grip.height/2)};
  const lifted={x:start.x,y:Math.round(row.y+12)};
  for(const interruption of ['grip','cancel','control']){
    await pointer.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
    await pointer.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[lifted]});
    await obscured.waitFor();
    await liveHand.waitFor({state:'hidden'});
    const ghost=page.locator('.touch-drag-ghost .battle-card');
    await ghost.waitFor();
    assert.equal(await ghost.count(),1);
    assert.equal(await turn.isVisible(),true);
    assert.equal(await page.locator('.own-mana .mana-crystals').isVisible(),true);
    if(interruption==='grip')await page.screenshot({path:'ui-evidence/mobile-hand-drag.png'});
    if(interruption!=='cancel'){
      const box=interruption==='control'?await turn.boundingBox():null;
      const end=box?{x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)}:start;
      await pointer.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});
    }
    await pointer.send('Input.dispatchTouchEvent',{type:interruption==='cancel'?'touchCancel':'touchEnd',touchPoints:[]});
    await obscured.waitFor({state:'detached'});
    await first.waitFor();
    assert.deepEqual(await currentHand(),beforeCancelled);
    assert.equal(await mana.textContent(),manaBeforeCancelled);
    assert.deepEqual(await page.evaluate(()=>window.touchActions),['mulligan']);
    assert.equal(await ghost.count(),0);
  }
  await page.evaluate(()=>{window.dragHitReads=0;});
  await drag(first,enemyBoard,async()=>{
    const reads=await page.evaluate(()=>{
      const count=window.dragHitReads;
      window.dragHitReads=null;
      return count;
    });
    assert.ok(reads>0&&reads<=5,'each delivered drag move needs at most one hit test, received '+reads);
    t.diagnostic('Hit tests across five minion drag moves: '+reads);
  });
  const summon=page.locator('.battle-fx-layer[data-fx-kind="summon"][data-fx-side="own"]');
  await summon.waitFor();
  assert.ok(await summon.locator('.fx-play-card .battle-card .card-copy').isVisible());
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
  assert.ok(await rail.evaluate(el=>{
    const visible=el.getBoundingClientRect();
    const entries=[...el.querySelectorAll('.impact-icon')].slice(0,3).map(button=>button.getBoundingClientRect());
    const captions=[...document.querySelectorAll('.battle-dialogue-captions')].filter(node=>node.childElementCount).map(node=>node.getBoundingClientRect());
    return el.scrollHeight>el.clientHeight&&entries.length===3&&entries.every(entry=>
      entry.top>=visible.top-.5&&entry.bottom<=visible.bottom+.5&&captions.every(caption=>entry.bottom<=caption.top||entry.top>=caption.bottom));
  }),'three complete action records stay clear of dialogue');
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
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await page.setViewportSize({width,height});
    await rail.locator('.impact-icon').first().waitFor();
    const history=await rail.boundingBox(),opponentHand=await page.locator('.hidden-hand').boundingBox();
    assert.ok(history&&opponentHand&&history.y>=opponentHand.y+opponentHand.height,JSON.stringify({width,history,opponentHand}));
    await page.screenshot({path:`ui-evidence/action-rail-${width}.png`});
  }
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
  await page.getByRole('button',{name:'대전',exact:true}).tap();
  await chooseBasicDeck(page,'전사');
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
          own.hand=[{cardId:'harsh_overseer',instanceId:'test-battlecry'},{cardId:'ice_shard',instanceId:'test-spell'},{cardId:'silver_protector',instanceId:'shield-card'},{cardId:'nature_choice',instanceId:'wrath-3'},{cardId:'nature_choice',instanceId:'wrath-1'},{cardId:'iron_axe',instanceId:'test-axe',costDiscount:2}];
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
  await page.locator('.battle-divider').tap({position:{x:12,y:3}});
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
  await page.locator('.own-hand[data-hand-obscured=true]').waitFor();
  await page.locator('.battle-hand').waitFor({state:'hidden'});
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
  await wolf.tap();
  await page.waitForFunction(()=>window.combatActions.some(action=>action.instanceId==='shield-card'&&action.target?.instanceId==='test-wolf'));
  await page.waitForFunction(()=>document.querySelector('[data-preview-minion="test-wolf"]')?.classList.contains('has-shield'));
  const chosenSpell=page.getByRole('button',{name:'주문 대상 지정',exact:true});
  for(const [index,id] of ['wrath-3','wrath-1'].entries()){
    await drag(page.locator(`[data-action-source="card:${id}"]`),page.locator('.enemy-board'));
    const choice=page.getByRole('dialog',{name:'카드 효과 선택'});
    await page.locator('.battle-hand').waitFor({state:'hidden'});
    await choice.getByRole('button',{name:index===0?'피해 3':'피해 1 + 드로우',exact:true}).tap();
    await chosenSpell.waitFor();
    if(index===0)await enemyUnit.tap();else await drag(chosenSpell,enemyUnit);
    await page.waitForFunction(({id,index})=>window.combatActions.some(action=>action.instanceId===id&&action.choice===index),{id,index});
  }
  await page.waitForFunction(()=>!document.querySelector('[data-preview-minion="test-enemy"]'));
  await drag(page.locator('[data-action-source="card:test-axe"]'),page.locator('.enemy-board'));
  await page.waitForFunction(()=>window.combatActions.some(action=>action.instanceId==='test-axe'));
  await page.locator('.self-hero-zone .weapon-slot.equipped').waitFor();
  await page.locator('.own-hand[data-hand-open=true] .battle-card').waitFor();
  assert.equal(await page.locator('.own-hand .battle-card').count(),1);
  if(profileDragWrites)t.diagnostic('Drag style write counts (not frame timings): '+JSON.stringify(await page.evaluate(()=>window.stopDragWriteProfile())));
  const lookups=await page.evaluate(()=>window.combatAnchorLookups);
  t.diagnostic('Combat DOM anchor queries: '+JSON.stringify(lookups));
  if(profileCombat)t.diagnostic('Active combat CPU 4x: '+JSON.stringify(await page.evaluate(()=>({...window.stopCombatProfile(),arenaReads:window.combatArenaReads}))));


  await context.close();
});

test('desktop displays both sides’ sequential discards and scrollable public action icons',{timeout:45000},async t=>{
  const baseline=process.env.CARD_DUEL_RAIL_BASELINE;
  const server=createSoloAppServer(baseline);
  server.prependListener('request',req=>{
    if(req.url.startsWith('/ui-preview/'))req.url=req.url.slice('/ui-preview'.length);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  await page.addInitScript(()=>{
    const BaseWorker=window.Worker;
    window.Worker=class extends BaseWorker{
      set onmessage(handler){
        super.onmessage=event=>{
          if(window.freezeFixture&&event.data.type==='view')return;
          if(event.data.type==='view'&&event.data.view.state?.phase==='playing'){
            const last=structuredClone(event.data);
            window.playPublicFixture=(events=[])=>{
              window.freezeFixture=true;
              last.view.state.revision++;
              last.view.animationSpeed=events.length?'fast':'instant';
              last.view.animation={revision:last.view.state.revision,actor:0,kind:'spell',cardId:'soul_flame',events};
              handler.call(this,new MessageEvent('message',{data:structuredClone(last)}));
            };
          }
          handler.call(this,event);
        };
      }
    };
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/ui-preview/');
  await page.getByRole('button',{name:'대전',exact:true}).click();
  if(baseline)await page.getByRole('button',{name:'전사',exact:true}).click();
  else await chooseBasicDeck(page,'전사');
  await page.getByRole('button',{name:'선택한 덱으로 대전 시작',exact:true}).click();
  await page.locator('.mulligan-confirm').click();
  await page.waitForFunction(()=>Boolean(window.playPublicFixture));
  await page.locator('.battle.phase-playing').waitFor();
  await page.evaluate(()=>window.playPublicFixture([
    {kind:'discard',side:0,cardId:'wolf'},
    {kind:'discard',side:1,cardId:'flame_sphere'},
  ]));
  const active=side=>page.locator(`.discard-reveal[data-discard-side="${side}"]:visible`);
  await active('own').waitFor();
  assert.ok(await active('own').locator('.battle-card .card-copy').isVisible());
  assert.equal(await active('opponent').count(),0);
  await page.screenshot({path:'ui-evidence/discard-own-v0330.png'});
  await active('opponent').waitFor();
  assert.equal(await active('own').count(),0);
  await page.screenshot({path:'ui-evidence/discard-opponent-v0330.png'});
  await page.locator('.discard-reveals').waitFor({state:'detached'});
  const rail=page.locator('.arena-left .impact-rail');
  for(let count=2;count<=7;count++){
    await page.evaluate(()=>window.playPublicFixture());
    await page.waitForFunction(count=>document.querySelectorAll('.arena-left .impact-icon').length>=count,count);
  }
  assert.ok(await rail.evaluate(el=>el.scrollHeight>el.clientHeight));
  assert.ok(await rail.evaluate(el=>[...el.querySelectorAll('.impact-icon')].filter(button=>button.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom+1).length>=3));
  const visibleIcons=()=>rail.evaluate(el=>[...el.querySelectorAll('.impact-icon')].filter(button=>{
    const r=button.getBoundingClientRect();
    const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return !!top&&button.contains(top);
  }).length);
  assert.ok(await visibleIcons()>=3,JSON.stringify(await rail.evaluate(el=>[el.parentElement.parentElement,...el.querySelectorAll('.impact-icon')].map(node=>{
    const r=node.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return [r.toJSON(),top?.className,getComputedStyle(node).visibility,getComputedStyle(node).zIndex];
  }))));
  const icon=rail.locator('.impact-icon').first();
  const size=await icon.evaluate(el=>{
    const rect=el.getBoundingClientRect();
    const glyph=el.querySelector('.impact-kind');
    return {width:rect.width,height:rect.height,glyph:parseFloat(getComputedStyle(glyph).fontSize)};
  });
  const previousHeight=768*.065;
  const factor=baseline?1:1.5;
  assert.ok(Math.abs(size.height-previousHeight*factor)<.1&&Math.abs(size.width-(previousHeight+12)*factor)<.1,JSON.stringify(size));
  assert.ok(Math.abs(size.glyph-768*.026*factor)<.1,JSON.stringify(size));
  t.diagnostic('Rendered desktop action icon: '+JSON.stringify(size));
  await page.screenshot({path:'ui-evidence/desktop-action-log-viewport.png'});
  if(!baseline){
    await icon.hover();
    const point=await icon.boundingBox();
    await page.mouse.move(point.x+point.width/2+3,point.y+point.height/2);
    await page.locator('.arena-left .impact-preview[data-open=true]').waitFor({timeout:4000});
    await page.mouse.move(450,380);
  }
  await icon.press('Enter');
  await page.locator('.arena-left .impact-preview[data-open=true]').waitFor({timeout:4000});
  await icon.press('Escape');
  await rail.evaluate(el=>el.scrollTop=el.scrollHeight);
  assert.ok(await rail.evaluate(el=>el.scrollTop>0));
  assert.ok(await visibleIcons()>=3);
  await page.screenshot({path:'ui-evidence/desktop-public-rail-v0330.png'});
  await page.setViewportSize({width:844,height:390});
  await rail.evaluate(el=>el.scrollTop=0);
  const compact=await icon.boundingBox();
  assert.ok(Math.abs(compact.width-43.2)<.1&&Math.abs(compact.height-31.2)<.1,JSON.stringify(compact));
  t.diagnostic('Rendered compact action icon: '+compact.width+' × '+compact.height+' px');
});
