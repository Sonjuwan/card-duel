import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';
import {chooseBasicDeck} from './deck-selection-browser.ts';

test('all actionable frames glow from engine eligibility and update when actions become unavailable',{timeout:45000},async t=>{
  const server=createSoloAppServer(process.env.RUNEHALL_GLOW_APP_DIR||undefined);
  server.prependListener('request',r=>{if(r.url.startsWith('/ui-preview/'))r.url=r.url.slice('/ui-preview'.length);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true,reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    const WorkerBase=window.Worker;
    window.Worker=class extends WorkerBase{
      set onmessage(handler){
        super.onmessage=handler?event=>{
          const message=event.data;
          if(message?.type==='view'&&message.view.state?.phase==='playing'){
            if(window.setGlowFixture)return;
            let revision=message.view.state.revision;
            window.setGlowFixture=(ready=true)=>{
              const fixture=structuredClone(message),state=fixture.view.state;
              const unit=(instanceId,props={})=>({cardId:'wolf',instanceId,attack:3,health:2,maxHealth:2,keywords:[],attacksRemaining:1,...props});
              state.revision=++revision;
              state.activePlayer=fixture.view.seat;
              state.opponent.board=[unit('enemy')];
              Object.assign(state.self,{mana:ready?4:0,maxMana:4,heroAttack:3,heroAttacksRemaining:ready?1:0,heroPowerUsed:!ready,
                hand:[{instanceId:'wolf-hand',cardId:'wolf'},{instanceId:'blocked',cardId:'fatal_finish'}],
                board:[unit('plain',ready?{}:{frozenThroughTurn:state.turn+1}),unit('taunt',{keywords:['taunt','divineShield'],attacksRemaining:ready?1:0})]});
              fixture.view.animation=undefined;
              handler.call(this,new MessageEvent('message',{data:fixture}));
            };
          }
          handler.call(this,event);
        }:null;
      }
    };
  });
  const url='http://127.0.0.1:'+server.address().port+'/ui-preview/';
  await page.goto(url);
  await page.getByRole('button',{name:'대전',exact:true}).click();
  await chooseBasicDeck(page,'전사');
  await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).click();
  await page.locator('.mulligan-confirm').click();
  await page.waitForFunction(()=>typeof window.setGlowFixture==='function');
  mkdirSync('ui-evidence',{recursive:true});
  for(const [width,height] of [[1440,900],[844,390]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>window.setGlowFixture());
    if(width<1000)await page.locator('.folded-hand').tap();
    const sources={
      card:page.locator('[data-action-source="card:wolf-hand"]'),
      blocked:page.locator('[data-action-source="card:blocked"]'),
      unit:page.locator('[data-preview-minion=plain]'),
      taunt:page.locator('[data-preview-minion=taunt]'),
      hero:page.locator('[data-action-source=hero]'),
      power:page.locator('[data-action-source=power]'),
    };
    await sources.card.waitFor();
    for(const [name,element] of Object.entries(sources)){
      const ready=name!=='blocked';
      assert.equal(await element.evaluate(e=>e.classList.contains('is-ready')),ready,name);
      if(!ready||process.env.RUNEHALL_GLOW_BASELINE==='1')continue;
      const paint=await element.evaluate((node,kind)=>{
        const outline=getComputedStyle(node).outlineStyle;
        const layer=kind==='power'?node.querySelector('.power-medallion'):node;
        return {outline:getComputedStyle(layer).outlineStyle,shadow:getComputedStyle(layer).boxShadow,
          silhouette:node.querySelector('.minion-taunt-frame path')?getComputedStyle(node.querySelector('.minion-taunt-frame path')).filter:null};
      },name);
      assert.equal(paint.outline,'none',name);
      if(name==='taunt')assert.match(paint.silhouette,/drop-shadow.*drop-shadow/);
      else assert.match(paint.shadow,/187, 255, 152/);
    }
    await page.screenshot({path:'ui-evidence/glow-'+width+'.png'});
    await page.evaluate(()=>window.setGlowFixture(false));
    await sources.hero.locator('xpath=self::*[not(contains(@class,"is-ready"))]').waitFor();
    for(const element of Object.values(sources))assert.equal(await element.evaluate(e=>e.classList.contains('is-ready')),false);
    assert.match(await sources.unit.getAttribute('class'),/is-frozen/);
    assert.equal(await sources.taunt.locator('[data-minion-status=shield]').count(),1);
  }
});
