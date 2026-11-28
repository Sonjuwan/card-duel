import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';
import {chooseBasicDeck} from './deck-selection-browser.ts';

test('mobile hand keeps its size, visible costs and independent mana with zero to ten cards',{timeout:60000},async t=>{
  const server=createSoloAppServer(process.env.RUNEHALL_HAND_APP_DIR||undefined);
  server.prependListener('request',r=>{if(r.url.startsWith('/ui-preview/'))r.url=r.url.slice('/ui-preview'.length);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(8500);
  const baseline=process.env.RUNEHALL_HAND_BASELINE==='1';
  await page.addInitScript(()=>{
    const WorkerBase=window.Worker;
    window.Worker=class extends WorkerBase{
      set onmessage(handler){
        super.onmessage=handler?event=>{
          const message=event.data;
          if(message?.type==='view'&&message.view.state?.phase==='playing'){
            if(window.setHandFixture)return;
            let revision=message.view.state.revision;
            window.setHandFixture=count=>{
              const fixture=structuredClone(message),state=fixture.view.state;
              state.revision=++revision;
              state.activePlayer=fixture.view.seat;
              state.opponent.handCount=10;
              state.self.mana=7;state.self.maxMana=10;
              state.self.handCount=count;
              const cards=['wolf','fatal_finish','iron_axe','grommash_hellscream','wolf','fatal_finish','wolf','iron_axe','wolf','wolf'];
              state.self.hand=Array.from({length:count},(_,i)=>({instanceId:'fixture-'+i,cardId:cards[i]}));
              for(const [which,side] of [['ally',state.self],['enemy',state.opponent]]){
                side.board=Array.from({length:7},(_,i)=>({cardId:'wolf',instanceId:which+i,attack:3,health:2,maxHealth:2,keywords:[],attacksRemaining:1}));
              }
              fixture.view.animation=undefined;
              handler.call(this,new MessageEvent('message',{data:fixture}));
            };
          }
          handler.call(this,event);
        }:null;
      }
    };
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/ui-preview/');
  await page.getByRole('button',{name:'대전',exact:true}).click();
  await chooseBasicDeck(page,'전사');
  await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).click();
  await page.locator('.mulligan-confirm').click();
  await page.waitForFunction(()=>typeof window.setHandFixture==='function');
  mkdirSync('ui-evidence',{recursive:true});
  for(const [width,height] of [[640,360],[844,390],[932,430]]){
    await page.setViewportSize({width,height});
    let first;
    for(let count=0;count<=10;count++){
      await page.evaluate(n=>window.setHandFixture(n),count);
      await page.locator('.battle-hand[data-count="'+count+'"]').waitFor({state:'attached'});
      if(!count){
        const folded=page.locator('.folded-hand[aria-expanded=false]');
        await folded.waitFor();
        assert.equal(await page.locator('.battle-hand').isVisible(),false);
        continue;
      }
      if(count===1){
        const folded=page.locator('.folded-hand[aria-expanded=false]');
        assert.equal(await folded.locator('.compact-hand-thumbnail .painted-art').count(),1);
        assert.equal(await page.locator('.own-mana .mana-crystals').isVisible(),false);
        await folded.tap();
      }
      await page.locator('.own-hand[data-hand-open=true] .battle-card').first().waitFor();
      const report=await page.evaluate(()=>{
        const rect=selector=>document.querySelector(selector).getBoundingClientRect();
        const enemy=rect('.enemy-board'),friendly=rect('.friendly-board'),hero=rect('.self-hero-zone');
        const mana=rect('.own-mana'),turn=rect('.end-turn'),deck=rect('.arena-right>.own-resources');
        const gems=getComputedStyle(document.querySelector('.own-mana .mana-crystals'));
        const hand=[...document.querySelectorAll('.battle-hand .battle-card')];
        const cards=hand.map(card=>{
          const box=card.getBoundingClientRect(),badge=card.querySelector('.card-mana').getBoundingClientRect();
          const hit=document.elementFromPoint(badge.x+badge.width*.5,badge.y+badge.height*.5);
          return {width:box.width,height:box.height,left:box.left,right:box.right,top:box.top,bottom:box.bottom,
            hit:hit?.closest('[data-action-source]')===card,compact:!card.querySelector('.card-copy,.card-tribe,.rarity-gem')};
        });
        const overlaps=(a,b)=>a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;
        const fieldClear=cards.every(card=>!overlaps(card,enemy)&&!overlaps(card,mana)&&!overlaps(card,turn));
        const boardClear=[...document.querySelectorAll('.minion-row .battle-minion')].every(unit=>!overlaps(unit.getBoundingClientRect(),turn));
        return {cards,fieldClear,boardClear,vertical:gems.display==='flex'&&gems.flexDirection.startsWith('column'),separate:!overlaps(mana,deck),
          overlap:(friendly.bottom-cards[0].top)/friendly.height,
          center:(cards[0].left+cards.at(-1).right)/2,
          full:cards[0].top<hero.top&&cards[0].bottom>hero.bottom-18,
          border:getComputedStyle(document.querySelector('.battle-arena')).borderTopWidth};
      });
      assert.equal(report.cards.length,count);
      const card=report.cards[0];
      if(count===1)first=card;
      if(!baseline){
        const diagnostic=JSON.stringify({width,count,report});
        assert.ok(report.cards.every(item=>item.hit&&item.compact&&Math.abs(item.width-first.width)<.2&&Math.abs(item.height-first.height)<.2),diagnostic);
        assert.ok(report.fieldClear&&report.boardClear&&report.vertical&&report.separate&&report.full,diagnostic);
        assert.ok(report.overlap>=.33&&report.overlap<=.501,diagnostic);
        assert.ok(Math.abs(report.center-width/2)<2,diagnostic);
        if(count===10&&width<=844)assert.ok(report.cards[1].left-report.cards[0].left<card.width,diagnostic);
      }
      if([1,4,7,10].includes(count)){
        await page.screenshot({path:'ui-evidence/hand-'+width+'-'+count+'.png'});
        t.diagnostic(JSON.stringify({width,count,card:[card.width,card.height],overlap:report.overlap,step:count>1?report.cards[1].left-card.left:null,border:report.border}));
      }
    }
  }
});
