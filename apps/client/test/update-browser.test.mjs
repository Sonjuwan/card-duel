import {chooseBasicDeck} from './deck-selection-browser.ts';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {test} from 'node:test';
import {chromium} from 'playwright';
import {loadSoloRelease} from '../../cli/serve-solo-app.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
function nextRelease(base){
  const files=new Map(base.files);
  const metadata=JSON.parse(files.get('version.json'));
  const segments=metadata.version.split('.').map(Number);
  segments[2]++;
  const version=segments.join('.');
  let html=files.get('index.html').toString().replaceAll(metadata.version,version);
  // Use changed bundle bytes so integrity and interrupted downloads still
  // exercise the network path after unchanged-cache reuse is introduced.
  for(const name of ['game.js','game.css']){
    const old=files.get(name);
    const changed=Buffer.concat([old,Buffer.from('\n/* next release fixture */\n')]);
    const sri=bytes=>'sha256-'+Buffer.from(hash(bytes),'hex').toString('base64');
    html=html.replace(sri(old),sri(changed));
    files.set(name,changed);
  }
  files.set('index.html',Buffer.from(html));
  const source=files.get('sw.js').toString();
  const marker=/^const release = (.+);$/m;
  const template=source.replace(marker,'const release = __CACHE_SPEC__;');
  const hashes=Object.fromEntries(Object.keys(JSON.parse(source.match(marker)[1]).files).map(name=>[name,hash(files.get(name))]));
  const release=hash(JSON.stringify(hashes)+template);
  files.set('sw.js',Buffer.from(template.replace('__CACHE_SPEC__',JSON.stringify({id:release,version,files:hashes}))));
  files.set('version.json',Buffer.from(JSON.stringify({version,release})));
  return {id:release,files,version};
}

test('installed game verifies and explicitly applies an update without reinstallation or losing saved games',{timeout:120000},async t=>{
  const base=loadSoloRelease();
  const previous=process.env.CARD_DUEL_PREVIOUS_PWA?loadSoloRelease(process.env.CARD_DUEL_PREVIOUS_PWA):undefined;
  const next=nextRelease(base),types={html:'text/html',js:'text/javascript',css:'text/css',json:'application/json',webmanifest:'application/manifest+json',png:'image/png'};
  let served=previous??base,mode='normal',stylesheetBlocked,notifyStyle;
  const candidateAssets=[],migrationAssets=[];
  const cachedPaths=new Set([...base.files.keys()].filter(name=>!['sw.js','version.json'].includes(name)));
  const server=createServer(async(req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname.slice('/ui-preview/'.length)||'index.html';
    const bytes=served.files.get(name);
    if(previous&&served===base&&cachedPaths.has(name))migrationAssets.push(name);
    if(!bytes){res.writeHead(404).end();return;}
    if(served===next&&['game.js','game.css','index.html','register.js','manifest.webmanifest','icon-192.png','icon-512.png'].includes(name))candidateAssets.push(name);
    if(served===next&&name==='game.css'&&mode==='block'){
      notifyStyle();await stylesheetBlocked;
    }
    if(served===next&&name==='game.css'&&mode==='disconnect'){res.destroy();return;}
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type',types[name.split('.').at(-1)]??'application/octet-stream');
    res.end(served===next&&name==='game.js'&&mode==='corrupt'?'damaged game script':bytes);
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const url=`http://127.0.0.1:${server.address().port}/ui-preview/`;
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:780,height:360},hasTouch:true,isMobile:true});
  const home=page=>page.getByRole('navigation',{name:'게임 메뉴'});
  const select=async(page,slot)=>{
    const gateway=page.getByRole('button',{name:`슬롯 ${slot} 선택`,exact:true});
    await home(page).or(gateway).first().waitFor();
    if(await gateway.isVisible())await gateway.click();
    else {
      await page.getByRole('button',{name:'슬롯 선택',exact:true}).click();
      const target=page.locator('.preview-slot-grid button').nth(slot-1);
      if(await target.isEnabled())await target.click();
      else await page.getByRole('button',{name:'메인으로',exact:true}).click();
    }
    await home(page).waitFor();
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  };
  let first=await context.newPage();await first.goto(url);await select(first,1);
  if(previous?.files.has('version.json')){
    const oldSlot=page=>page.evaluate(async()=>{
      const open=indexedDB.open('card-duel-solo-saves-v1-ui-preview',2);
      const db=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
      try{return await new Promise((resolve,reject)=>{
        const read=db.transaction('growth').objectStore('growth').get('player');
        read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);
      });}finally{db.close();}
    });
    await first.getByRole('button',{name:/경험치 · 카드 획득/}).tap();
    await first.getByRole('region',{name:'보상의 길'}).waitFor();
    const historic=await oldSlot(first);
    Object.assign(historic.profile,{xp:30,rankWins:1,revision:1,ownedCards:[...new Set([...historic.profile.ownedCards,'cairne_bloodhoof'])].sort(),
      matchStats:{ranked:{wins:1,losses:0,draws:0},pvp:{wins:0,losses:0,draws:0}},
      recentMatches:[{matchId:'legacy-verified',mode:'ranked',rank:1,rankAfter:1,heroClass:'warrior',outcome:'win',completedAt:1700000000000,xp:30,questAdvanced:false,eligible:true}]});
    delete historic.profile.rewardRoad;
    historic.settledMatchIds=['legacy-verified'];
    await first.evaluate(async legacy=>{
      const open=indexedDB.open('card-duel-solo-saves-v1-ui-preview',2);
      const db=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
      try{await new Promise((resolve,reject)=>{
        const tx=db.transaction('growth','readwrite');
        tx.objectStore('growth').put(legacy,'player');
        tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
      });}finally{db.close();}
    },historic);
    await first.getByRole('button',{name:'메인으로',exact:true}).tap();

    const dialog=first.getByRole('dialog',{name:'게임 업데이트'});
    await first.getByRole('button',{name:'게임 업데이트',exact:true}).tap();
    served=base;
    await dialog.getByRole('button',{name:'업데이트 확인',exact:true}).tap();
    await dialog.getByRole('button',{name:'최신 버전 적용',exact:true}).tap();
    await select(first,1);
    await first.getByRole('button',{name:/보상의 길/}).tap();
    await first.getByRole('heading',{name:'오리지널 보상의 길'}).waitFor();
    const migrated=await oldSlot(first);
    assert.equal(migrated.profile.rewardRoad.paths.original.xp,historic.profile.xp);
    assert.equal(migrated.profile.rankWins,historic.profile.rankWins);
    assert.deepEqual(migrated.settledMatchIds,historic.settledMatchIds);
    assert.ok(historic.profile.ownedCards.every(id=>migrated.profile.ownedCards.includes(id)));
    await first.getByRole('button',{name:'메인으로',exact:true}).tap();
    const downloaded=[...new Set(migrationAssets)].sort();
    const changed=[...base.files.keys()].filter(name=>
      !['sw.js','version.json'].includes(name)&&!base.files.get(name).equals(previous.files.get(name)??Buffer.alloc(0))
    ).sort();
    assert.deepEqual(downloaded,changed);
    t.diagnostic('Previous release update payload: '+migrationAssets.reduce((sum,name)=>sum+base.files.get(name).length,0)+' bytes');
  }else if(previous){
    assert.equal(await first.getByRole('button',{name:'게임 업데이트'}).count(),0);
    served=base;
    await first.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
    await first.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
    await first.close();
    // A legacy waiting worker only activates after its last client closes.
    // Give that background transition a chance before navigation reclaims it.
    for(let attempt=0;attempt<5;attempt++){
      await delay(500);
      first=await context.newPage();await first.goto(url);
      if(await first.locator('meta[name="card-duel-build"]').count())break;
      if(attempt<4)await first.close();
    }
    await select(first,1);
  }
  assert.equal(await first.evaluate(()=>document.documentElement.scrollHeight),360);
  const errors=[];first.on('pageerror',err=>errors.push(err.message));
  await first.getByRole('button',{name:'게임 업데이트',exact:true}).tap();
  const dialog=first.getByRole('dialog',{name:'게임 업데이트'});
  const check=dialog.getByRole('button',{name:'업데이트 확인',exact:true});
  const apply=dialog.getByRole('button',{name:'최신 버전 적용',exact:true});
  await dialog.getByText('최신 버전 사용 중',{exact:true}).waitFor();
  await context.setOffline(true);await check.tap();
  await dialog.getByText(/공개 버전을 확인하지 못했습니다/).waitFor();
  await first.reload();await select(first,1);
  await first.getByRole('button',{name:'게임 업데이트',exact:true}).tap();
  await dialog.getByText(/공개 버전을 확인하지 못했습니다/).waitFor();
  assert.equal(await apply.isDisabled(),true);
  await context.setOffline(false);
  await dialog.getByText('최신 버전 사용 중',{exact:true}).waitFor();
  served=next;
  for(const fault of ['disconnect','corrupt']){
    mode=fault;await check.tap();
    await dialog.getByText(/다운로드 또는 파일 검증에 실패했습니다/).waitFor();
    assert.equal(await apply.isDisabled(),true);
  }
  candidateAssets.length=0;
  mode='block';
  let releaseStyle;
  stylesheetBlocked=new Promise(resolve=>{releaseStyle=resolve;});
  const waitingForStylesheet=new Promise(resolve=>{notifyStyle=resolve;});
  await check.tap();
  await waitingForStylesheet;
  const progress=dialog.getByRole('progressbar',{name:'업데이트 다운로드 진행률'});
  await progress.waitFor();
  await first.waitForFunction(()=>document.querySelector('#solo-update-progress').value>0);
  assert.equal(await apply.isDisabled(),true);
  mode='normal';releaseStyle();
  await dialog.getByText(/파일 검증 완료/).waitFor();
  assert.deepEqual([...new Set(candidateAssets)].sort(),['game.css','game.js','index.html']);

  const second=await context.newPage();
  await second.setViewportSize({width:1366,height:768});
  await second.goto(url);await select(second,2);
  await second.getByRole('button',{name:'게임 업데이트',exact:true}).click();
  const desktopDialog=second.getByRole('dialog',{name:'게임 업데이트'});
  await desktopDialog.waitFor();
  await desktopDialog.getByRole('button',{name:'닫기',exact:true}).click();
  await second.getByRole('button',{name:'대전',exact:true}).tap();
  await chooseBasicDeck(second,'전사');
  await second.getByRole('button',{name:'선택한 덱으로 대전 시작'}).tap();
  await second.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();

  await apply.tap();
  await dialog.getByText(/진행 중인 대전을 저장하고/).waitFor();
  assert.equal(await second.getByRole('heading',{name:'첫 손패를 선택하세요'}).isVisible(),true);
  await second.locator('.mulligan-confirm').tap();
  await second.getByRole('button',{name:'전투 설정'}).tap();
  await second.getByRole('button',{name:'저장 후 나가기'}).tap();
  await second.getByRole('button',{name:'메인으로'}).tap();
  const snapshot=page=>page.evaluate(async()=>{
    const open=indexedDB.open('card-duel-solo-saves-v1-slot-2-ui-preview',2);
    const db=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
    const read=(name)=>new Promise((resolve,reject)=>{
      const request=db.transaction(name).objectStore(name).getAll();
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    try{return await Promise.all([read('matches'),read('growth')]);}finally{db.close();}
  });
  const before=await snapshot(second);
  assert.ok(before[0].length&&before[1].length);
  const deckKeys=await second.evaluate(deck=>{
    const slot='card-duel-ui-preview-slot-2:';
    const keys=[slot+'card-duel-saved-decks',slot+'developer:card-duel-saved-decks'];
    for(const key of keys)localStorage.setItem(key,JSON.stringify([{name:'업데이트 시험 덱',deck}]));
    return keys;
  },before[0][0].snapshot.input.deck);
  await apply.tap();
  for(const page of [first,second]){
    await page.waitForFunction(version=>document.querySelector('meta[name="card-duel-build"]')?.content===version,next.version);
    await home(page).waitFor();
  }
  assert.deepEqual(await snapshot(second),before);
  assert.ok((await second.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),deckKeys)).every(value=>value?.includes('업데이트 시험 덱')));
  await second.getByRole('button',{name:'대전',exact:true}).tap();
  await second.getByRole('button',{name:'이어서 플레이하기'}).tap();
  await second.locator('.battle.phase-playing').waitFor();
  assert.deepEqual(errors,[]);
});
