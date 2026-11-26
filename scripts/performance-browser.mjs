import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {once} from 'node:events';

const root=resolve(process.argv[2]??'.');
const throttle=Number(process.env.CARD_DUEL_CPU_THROTTLE??1);
if(!Number.isFinite(throttle)||throttle<1)throw Error('CPU throttle must be at least 1.');
const {createSoloAppServer}=await import(pathToFileURL(root+'/apps/cli/serve-solo-app.mjs'));
const server=createSoloAppServer(root+'/dist/solo-app');
server.listen(0,'127.0.0.1');
await once(server,'listening');
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
const results=[];

async function sample(mobile){
  const context=await browser.newContext({
    viewport:mobile?{width:780,height:360}:{width:1366,height:768},
    isMobile:mobile,hasTouch:mobile
  });
  try{
    const page=await context.newPage();
    const cdp=await context.newCDPSession(page);
    if(throttle>1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
    await cdp.send('Performance.enable');
    await page.addInitScript(()=>{
      const postMessage=Worker.prototype.postMessage;
      Worker.prototype.postMessage=function(message,...options){
        if(message?.type==='start')message={...message,input:{...message.input,seed:10,deckSeed:123}};
        return postMessage.call(this,message,...options);
      };
      window.longTasks=[];
      window.longFrames=[];
      if(PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')){
        new PerformanceObserver(list=>{
          window.longFrames.push(...list.getEntries().map(entry=>({
            start:entry.startTime,duration:entry.duration,blocking:entry.blockingDuration,
            forcedLayout:entry.scripts.reduce((sum,script)=>sum+script.forcedStyleAndLayoutDuration,0)
          })));
        }).observe({type:'long-animation-frame',buffered:true});
      }
      new PerformanceObserver(list=>{
        window.longTasks.push(...list.getEntries().map(entry=>entry.duration));
      }).observe({type:'longtask',buffered:true});
    });
    const home=page.getByRole('navigation',{name:'게임 메뉴'});
    const metrics=()=>page.evaluate(()=>({
      menuMs:performance.now(),
      assets:Object.fromEntries(performance.getEntriesByType('resource')
        .filter(entry=>/game\.(js|css)$/.test(entry.name))
        .map(entry=>[entry.name.split('/').at(-1),{ms:entry.duration,bytes:entry.decodedBodySize}])),
      longTasks:window.longTasks,
      heap:performance.memory?.usedJSHeapSize
    }));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await home.waitFor();
    const cold=await metrics();
    const {metrics:devToolsMetrics}=await cdp.send('Performance.getMetrics');
    cold.cpuMs=Object.fromEntries(devToolsMetrics
      .filter(entry=>['ScriptDuration','TaskDuration','RecalcStyleDuration','LayoutDuration'].includes(entry.name))
      .map(entry=>[entry.name,entry.value*1000]));
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const installReadyMs=await page.evaluate(()=>performance.now());
    await context.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded'});
    await home.waitFor();
    const offline=await metrics();
    await page.getByRole('button',{name:'대전',exact:true}).click();
    await page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기'}).click();
    await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).click();
    await page.locator('.mulligan-confirm').click();
    await page.locator('.battle-arena').waitFor();
    const frames=await page.evaluate(()=>new Promise(resolve=>{
      const start=performance.now();
      const times=[];
      let prior;
      function frame(now){
        if(prior!==undefined)times.push(now-prior);
        prior=now;
        if(times.length<120){requestAnimationFrame(frame);return;}
        const total=times.reduce((sum,elapsed)=>sum+elapsed,0);
        times.sort((a,b)=>a-b);
        resolve({fps:120000/total,p95:times[113],p99:times[118],
          heap:performance.memory?.usedJSHeapSize,longTasks:window.longTasks,
          longFrames:window.longFrames.filter(entry=>entry.start+entry.duration>=start)});
      }
      requestAnimationFrame(frame);
    }));
    const art=await page.evaluate(async()=>{
      const entries=[...document.querySelectorAll('.painted-art')].map(el=>({name:el.className,background:getComputedStyle(el).backgroundImage}));
      const unique=new Map(entries.map(item=>[item.name,item.background]));
      const results=[];
      for(const [name,background] of [...unique].sort((a,b)=>a[0].localeCompare(b[0]))){
        if(!background.includes('data:image/webp;base64,'))throw Error('Missing painted background: '+name);
        const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(background));
        results.push({name,hash:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')});
      }
      if(!results.length)throw Error('No offline battle art rendered');
      return results;
    });
    return {mobile,throttle,cold,offline,installReadyMs,frames,art};
  }finally{await context.close();}
}

try{
  for(const mobile of [true,false]){
    for(let run=0;run<3;run++)results.push(await sample(mobile));
  }
  console.log(JSON.stringify(results));
}finally{
  await browser.close();
  server.closeAllConnections();
  server.close();
}
