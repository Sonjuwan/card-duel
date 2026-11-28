import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';
import {chooseBasicDeck} from './deck-selection-browser.ts';

async function browserGame(t){
  const server=createSoloAppServer();
  server.prependListener('request',r=>{if(r.url.startsWith('/ui-preview/'))r.url=r.url.slice('/ui-preview'.length);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  return {browser,url:'http://127.0.0.1:'+server.address().port+'/ui-preview/'};
}

test('shield silhouettes, legal targets and stacked statuses track updates on large and short battlefields',{timeout:75000},async t=>{
  const {browser,url}=await browserGame(t);
  mkdirSync('ui-evidence',{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage();
  page.setDefaultTimeout(9000);
  await page.addInitScript(()=>{
    const WorkerBase=window.Worker;
    window.Worker=class extends WorkerBase{
      set onmessage(handler){
        super.onmessage=handler?event=>{
          const message=event.data;
          if(message?.type==='view'&&message.view.state?.phase==='playing'){
            if(window.renderStatusFixture)return;
            let revision=message.view.state.revision;
            window.renderStatusFixture=(cleared=false)=>{
              const fixture=structuredClone(message),state=fixture.view.state;
              fixture.view.animation=undefined;
              state.revision=++revision;
              state.activePlayer=fixture.view.seat;
              const unit=(instanceId,properties={})=>({cardId:'wolf',instanceId,attack:3,health:2,maxHealth:2,
                keywords:[],attacksRemaining:1,...properties});
              state.opponent.board=[
                unit('ordinary'),
                unit('warded',{keywords:cleared?[]:['taunt','divineShield'],...(cleared?{silenced:true}:{deathrattleSummons:['wolf']})}),
                unit('ice',{keywords:['taunt'],...(cleared?{}:{frozenThroughTurn:state.turn+1})}),
                unit('wind',{keywords:cleared?['windfury']:['windfury','divineShield']}),
                unit('hidden',{keywords:['stealth','poisonous']}),
                unit('rush',{cardId:'grommash_hellscream',keywords:['charge'],maxHealth:9,
                  health:cleared?9:4,attack:cleared?4:10}),
                unit('silenced',{silenced:true}),
              ];
              state.self.board=Array.from({length:7},(_,i)=>unit('ally-'+i));
              handler.call(this,new MessageEvent('message',{data:fixture}));
            };
          }
          handler.call(this,event);
        }:null;
      }
    };
  });
  await page.goto(url);
  await page.getByRole('button',{name:'대전',exact:true}).click();
  await chooseBasicDeck(page,'전사');
  await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).click();
  await page.locator('.mulligan-confirm').click();
  await page.waitForFunction(()=>typeof window.renderStatusFixture==='function');
  const minion=id=>page.locator('[data-preview-minion="'+id+'"]');
  for(const [width,height] of [[1440,900],[1024,768],[844,390],[640,360]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>window.renderStatusFixture());
    await minion('warded').locator('[data-minion-status=shield]').waitFor();
    const marks=id=>minion(id).locator('[data-minion-status]').evaluateAll(nodes=>nodes.map(node=>node.dataset.minionStatus));
    assert.deepEqual(await marks('warded'),['shield','death']);
    assert.deepEqual(await marks('ice'),['frost']);
    assert.deepEqual(await marks('wind'),['shield','wind']);
    assert.deepEqual(await marks('hidden'),['stealth','poison']);
    assert.deepEqual(await marks('rush'),['charge','enrage']);
    assert.deepEqual(await marks('silenced'),['silence']);
    const measurements=await page.locator('.enemy-board .battle-minion').evaluateAll(units=>{
      const rect=node=>node.getBoundingClientRect();
      const overlaps=(a,b)=>a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;
      return units.map(unit=>{
        const box=rect(unit);
        const icons=[...unit.querySelectorAll('.minion-status-icons>i,.taunt-medal')].map(rect);
        const stats=[...unit.querySelectorAll('.minion-statline>.stat')].map(rect);
        const mask=unit.querySelector('.minion-medallion');
        return {size:[box.width,box.height],shield:getComputedStyle(mask).clipPath.startsWith('polygon('),
          art:mask.querySelector('.painted-art').getBoundingClientRect().width,
          clear:icons.every((a,i)=>stats.every(b=>!overlaps(a,b))&&icons.slice(i+1).every(b=>!overlaps(a,b)))};
      });
    });
    assert.equal(measurements.length,7);
    const [ordinary,warded,ice]=measurements;
    assert.equal(ordinary.shield,false);
    assert.ok(warded.shield&&ice.shield);
    assert.ok(measurements.every(row=>row.clear&&row.art>=ordinary.art-.1&&Math.abs(row.size[0]-ordinary.size[0])<.1),JSON.stringify(measurements));
    await minion('ally-0').press('Enter');
    await minion('warded').locator('.minion-taunt-frame').waitFor();
    assert.deepEqual(await page.locator('.enemy-board [data-taunt-target=true]').evaluateAll(nodes=>nodes.map(node=>node.dataset.previewMinion)),['warded','ice']);
    await page.screenshot({path:`ui-evidence/status-stacked-${width}.png`});
    await minion('ally-0').press('Enter');
    await page.evaluate(()=>window.renderStatusFixture(true));
    await minion('warded').locator('[data-minion-status=silence]').waitFor();
    assert.equal(await minion('warded').locator('.minion-taunt-frame,.shield-ring,[data-minion-status=death]').count(),0);
    assert.equal(await minion('ice').locator('[data-minion-status=frost]').count(),0);
    assert.equal(await minion('wind').locator('[data-minion-status=wind]').count(),1);
    assert.equal(await minion('wind').locator('[data-minion-status=shield]').count(),0);
    assert.deepEqual(await marks('rush'),['charge']);
  }
  await context.close();
});
