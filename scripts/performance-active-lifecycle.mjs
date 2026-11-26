import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const root=resolve(process.argv[2]??'.'),matches=Number(process.argv[3]??8);
const throttle=Number(process.env.CARD_DUEL_CPU_THROTTLE??4);
assert.ok(Number.isSafeInteger(matches)&&matches>=1&&matches<=30);
assert.ok(Number.isFinite(throttle)&&throttle>=1);
const {createSoloAppServer}=await import(pathToFileURL(root+'/apps/cli/serve-solo-app.mjs'));
const server=createSoloAppServer(root+'/dist/solo-app');
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
try{
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  const page=await context.newPage(),cdp=await context.newCDPSession(page),system=await browser.newBrowserCDPSession();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
  await cdp.send('Performance.enable');
  let layers=null,peakLayers=0,paints=0;
  cdp.on('LayerTree.layerTreeDidChange',event=>{if(event.layers){layers=event.layers.length;peakLayers=Math.max(peakLayers,layers);}});
  cdp.on('LayerTree.layerPainted',()=>paints++);
  try{await cdp.send('LayerTree.enable');}catch{/* Optional compositing diagnostics. */}
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;
    window.acceptedEndTurns=0;
    Worker.prototype.postMessage=function(message,...rest){
      if(message?.type==='start')message={...message,input:{...message.input,seed:10,deckSeed:123}};
      if(message?.type==='act'&&message.action?.type==='endTurn'){
        const receive=event=>{
          if(event.data?.requestId!==message.requestId)return;
          this.removeEventListener('message',receive);
          if(event.data?.type==='view')window.acceptedEndTurns++;
        };
        this.addEventListener('message',receive);
      }
      return post.call(this,message,...rest);
    };
    window.longFrameCount=0;window.longFrameMs=0;
    if(PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')){
      new PerformanceObserver(list=>{for(const entry of list.getEntries()){window.longFrameCount++;window.longFrameMs+=entry.duration;}}).observe({type:'long-animation-frame'});
    }
  });
  const records=page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기'});
  const home=page.getByRole('button',{name:'대전',exact:true});
  const ownTurn=page.locator('.end-turn.your-turn:not([disabled])');
  const result=page.getByRole('dialog',{name:'대전 결과'});
  const openRecords=async()=>{if(await home.isVisible())await home.click();await records.click();};
  async function sample(label,collect=false){
    if(collect)await cdp.send('HeapProfiler.collectGarbage');
    const heap=await cdp.send('Runtime.getHeapUsage'),dom=await cdp.send('Memory.getDOMCounters');
    const perf=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.filter(x=>['ScriptDuration','TaskDuration','LayoutDuration','RecalcStyleDuration'].includes(x.name)).map(x=>[x.name,x.value]));
    let processCpuSeconds=null;
    try{const {processInfo}=await system.send('SystemInfo.getProcessInfo');processCpuSeconds=Object.fromEntries([...new Set(processInfo.map(p=>p.type))].map(type=>[type,processInfo.filter(p=>p.type===type).reduce((n,p)=>n+p.cpuTime,0)]));}catch{/* Process metrics may not be exposed. */}
    return {label,jsHeapBytes:heap.usedSize,embedderHeapBytes:heap.embedderHeapUsedSize??null,...dom,workers:page.workers().length,
      layers,peakLayers,paints,processCpuSeconds,perf,...await page.evaluate(()=>({longFrames:window.longFrameCount,longFrameMs:window.longFrameMs}))};
  }
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await home.waitFor();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const samples=[await sample('menu-initial',true)];
  let turns=0;
  for(let cycle=1;cycle<=matches;cycle++){
    await openRecords();
    await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).click();
    await page.locator('.mulligan-confirm').click();
    await ownTurn.or(result).first().waitFor({timeout:60000});
    for(let turn=0;turn<5;turn++){
      if(await result.isVisible())break;
      await ownTurn.click();turns++;
      await page.waitForFunction(count=>window.acceptedEndTurns===count,turns,{timeout:60000});
      await ownTurn.or(result).first().waitFor({timeout:60000});
    }
    samples.push(await sample('active-'+cycle));
    if(!await result.isVisible()){
      const desktop=page.locator('.desktop-concede');
      if(await desktop.isVisible())await desktop.click();
      else{
        await page.getByRole('button',{name:'전투 기록과 도움말 열기'}).click();
        await page.getByRole('dialog',{name:'전투 기록과 도움말'}).getByRole('button',{name:'항복',exact:true}).click();
      }
      await result.waitFor({timeout:60000});
    }
    await result.getByRole('button',{name:'대전 준비로 돌아가기'}).click();
    await records.waitFor();
    await page.waitForFunction(()=>!document.querySelector('.duel-screen'));
    // Rewards are part of the normal completed-match lifecycle. Do not
    // bypass their DOM or animation; close using the actual user controls.
    const reward=page.locator('.preview-card-reward-overlay');
    if(await reward.isVisible()){
      await reward.getByRole('button',{name:/^(연출 건너뛰기|계속하기)$/}).click();
      await reward.waitFor({state:'hidden'});
    }
    const deadline=Date.now()+5000;
    while(page.workers().length&&Date.now()<deadline)await delay(100);
    const idle=await sample('menu-'+cycle,true);samples.push(idle);
    assert.equal(idle.workers,0,'No battle worker may remain after returning to menu');
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({matches,turns,throttle,samples,note:'Browser-level CPU time, layer count and paint events are proxies, not physical GPU utilization, GPU memory, temperature or battery drain. Active heap is uncollected; menu heap follows forced GC.'}));
}finally{await browser.close();server.closeAllConnections();server.close();}
