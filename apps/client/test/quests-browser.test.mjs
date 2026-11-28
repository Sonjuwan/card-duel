import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';
import {CardStore} from '../../server/card-store.ts';
import {basicDeck} from '../../../packages/basic-decks.ts';
import {rankedXpReward} from '../../../packages/progression.ts';
import {createOfflineRankedInput,offlineGrowth,readOfflineGrowth} from '../src/offline-growth.ts';
import {LocalDuel} from '../src/local-duel.ts';

const slotDb='card-duel-solo-saves-v1-ui-preview';
async function browserAndServer(t){
  const server=createSoloAppServer();
  server.prependListener('request',request=>{if(request.url?.startsWith('/ui-preview/'))request.url=request.url.slice('/ui-preview'.length);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  return {browser,url:'http://127.0.0.1:'+server.address().port+'/ui-preview/'};
}

test('the three active quests and their portraits fit desktop, tablet and narrow phones',{timeout:55000},async t=>{
  const {browser,url}=await browserAndServer(t);
  mkdirSync('ui-evidence',{recursive:true});
  for(const [label,width,height,touch] of [['desktop',1366,768,false],['tablet',1024,768,true],['phone',844,390,true],['small-phone',640,300,true]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);
    await page.getByRole('button',{name:'퀘스트',exact:true}).click();
    const quests=page.getByRole('region',{name:'퀘스트',exact:true});
    await quests.getByRole('article').nth(2).waitFor();
    assert.equal(await quests.getByRole('article').count(),3);
    assert.equal(await quests.getByRole('progressbar').count(),3);
    assert.equal(await quests.locator('.quest-portrait [data-art-asset]').count(),3);
    const layout=await quests.evaluate(el=>{
      const controls=[...document.querySelectorAll('.floating-home button,.lobby-settings-entry button')].filter(n=>n.getClientRects().length);
      const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      return {tiles:[...el.querySelectorAll('.quest-tile')].map(node=>{
        const r=node.getBoundingClientRect(),title=node.querySelector('h3');
        const text=document.createRange();text.selectNodeContents(title);
        const ink=text.getBoundingClientRect();
        const progress=node.querySelector('progress').getBoundingClientRect();
        return {inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
          noOverlap:controls.every(button=>!overlap(r,button.getBoundingClientRect())),
          titleVisible:ink.top>=r.top&&ink.bottom<=r.bottom&&ink.left>=r.left&&ink.right<=r.right,
          progressVisible:progress.width>0&&progress.top>=ink.bottom&&progress.bottom<=r.bottom
        };
      }),viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]};
    });
    await page.screenshot({path:`ui-evidence/quests-${label}.png`});
    assert.ok(layout.tiles.every(item=>item.inside&&item.titleVisible&&item.noOverlap&&item.progressVisible),JSON.stringify({label,layout}));
    assert.deepEqual(layout.document,layout.viewport);
    assert.deepEqual(errors,[]);
    await page.getByRole('button',{name:'메인으로'}).click();
    await page.getByRole('button',{name:'대전',exact:true}).waitFor();
    await context.close();
  }
});

test('real worker resumes a partial battle, settles quest XP once, restores sequential reveals and isolates slots',{timeout:70000},async t=>{
  const {browser,url}=await browserAndServer(t);
  const {catalog,cards}=new CardStore().read();
  const growth=offlineGrowth(catalog),hash=createHash('sha256').update(JSON.stringify(cards)).digest('hex');
  const record=readOfflineGrowth(undefined,growth);
  record.profile.xp=13;
  record.profile.rewardRoad.paths.original.xp=13;
  const active=record.profile.quests.active;
  active.basic.progress=9;
  active.common={...active.common,hero:'warrior',metric:'armor',title:'방어도 획득',unit:'방어도',target:80,progress:76};
  const input=createOfflineRankedInput({catalog,catalogHash:hash,code:'LOCAL-QUEST-BROWSER',
    seed:3,deck:basicDeck(catalog,'warrior'),heroClass:'mage',difficulty:1,animationSpeed:'instant'},record,growth);
  const checkpoint=new LocalDuel(input).checkpoint();
  Object.assign(checkpoint.state,{phase:'playing',activePlayer:0,turn:7});
  Object.assign(checkpoint.summary,{phase:'playing',turn:7});
  Object.assign(checkpoint.state.players[0],{mana:4,maxMana:4});
  for(const player of checkpoint.state.players)player.mulliganDone=true;
  const duel=LocalDuel.restore(checkpoint,catalog,hash);
  duel.act(checkpoint.state.revision,{type:'heroPower'});
  const paused=duel.checkpoint();
  paused.state.players[0].heroPowerUsed=false;
  const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('dialog',dialog=>void dialog.accept());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  const button=name=>page.getByRole('button',{name,exact:true});
  await button('퀘스트').click();
  await page.locator('.quest-tile').nth(2).waitFor();
  await page.evaluate(async({slotDb,record,paused,hash})=>{
    const open=indexedDB.open(slotDb,2);
    const db=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(['growth','matches'],'readwrite');
        tx.objectStore('growth').put(record,'player');
        tx.objectStore('matches').put({hash,owner:'quest-test',snapshot:paused});
        tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
      });
    }finally{db.close();}
  },{slotDb,record,paused,hash});
  const read=()=>page.evaluate(async({slotDb,hash})=>{
    const open=indexedDB.open(slotDb,2);
    const db=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
    try{
      const tx=db.transaction(['growth','matches'],'readonly');
      const get=(store,key)=>new Promise((resolve,reject)=>{const request=tx.objectStore(store).get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      return await Promise.all([get('growth','player'),get('matches',hash)]);
    }finally{db.close();}
  },{slotDb,hash});
  await page.reload();
  await button('퀘스트').click();
  await page.getByText('9 / 10판',{exact:true}).waitFor();
  await page.getByText('76 / 80방어도',{exact:true}).waitFor();
  await button('메인으로').click();
  await button('대전').click();
  await button('이어서 플레이하기').click();
  await page.locator('.phase-playing').waitFor();
  await page.locator('.self-hero-zone .hero-power').press('Enter');
  await page.waitForFunction(()=>document.querySelector('.self-hero-zone .hero-power')?.classList.contains('spent'));
  const [during,mid]=await read();
  assert.equal(during.profile.xp,13);
  assert.equal(during.profile.quests.active.basic.progress,9);
  assert.equal(mid.snapshot.questCounters.armor,4);
  await button('전투 설정').click();
  await button('항복하기').click();
  await page.getByRole('list',{name:'완료한 퀘스트'}).locator('li').nth(1).waitFor();
  await page.screenshot({path:'ui-evidence/quests-completed.png'});
  const [after,completed]=await read(),receipt=after.profile.recentMatches[0];
  assert.equal(completed.snapshot.summary.phase,'finished');
  assert.equal(after.profile.xp,13+rankedXpReward(1,'loss')+60);
  assert.equal(after.profile.rewardRoad.paths.original.xp,after.profile.xp);
  assert.equal(receipt.questBonusXp,60);
  assert.equal(receipt.completedQuests.length,2);
  assert.equal(after.settledMatchIds.length,1);
  assert.notEqual(after.profile.quests.active.basic.id,active.basic.id);
  await page.reload();
  const reveal=page.getByRole('dialog',{name:'새 카드 획득'});
  for(const id of receipt.unlockedCards){
    await reveal.locator(`[data-preview-card="${id}"]`).waitFor();
    await page.locator('.preview-card-reward-overlay[data-ready=true]').waitFor();
    await page.waitForTimeout(540);
    await reveal.press('Enter');
  }
  await reveal.waitFor({state:'detached'});
  await page.reload();
  await button('퀘스트').waitFor();
  assert.equal(await reveal.count(),0);
  assert.deepEqual((await read())[0],after);
  await button('슬롯 선택').click();
  await button('슬롯 2').click();
  await button('퀘스트').click();
  await page.getByText('0 / 10판',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  await context.close();
});
