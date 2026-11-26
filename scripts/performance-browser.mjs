import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {once} from 'node:events';
const root=resolve(process.argv[2]??'.');
const {createSoloAppServer}=await import(root+'/apps/cli/serve-solo-app.mjs');
const server=createSoloAppServer(root+'/dist/solo-app');
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
const results=[];
try{
for(const mobile of [true,false])for(let run=0;run<3;run++){
const context=await browser.newContext({viewport:mobile?{width:780,height:360}:{width:1366,height:768},isMobile:mobile,hasTouch:mobile});
const page=await context.newPage();
await page.addInitScript(()=>{window.longTasks=[];new PerformanceObserver(list=>window.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});});
const url='http://127.0.0.1:'+server.address().port+'/';
const home=page.getByRole('navigation',{name:'게임 메뉴'});
await page.goto(url,{waitUntil:'domcontentloaded'});await home.waitFor();
const metrics=()=>page.evaluate(()=>({menuMs:performance.now(),assets:Object.fromEntries(performance.getEntriesByType('resource').filter(e=>/game\.(js|css)$/.test(e.name)).map(e=>[e.name.split('/').at(-1),{ms:e.duration,bytes:e.decodedBodySize}])),longTasks:window.longTasks,heap:performance.memory?.usedJSHeapSize}));
const cold=await metrics();
await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await home.waitFor();
const offline=await metrics();
await page.getByRole('button',{name:'대전',exact:true}).click();
await page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기'}).click();
await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).click();
await page.locator('.mulligan-confirm').click();await page.locator('.battle-arena').waitFor();
const frames=await page.evaluate(()=>new Promise(resolve=>{
const times=[];let prior;function frame(now){if(prior!==undefined)times.push(now-prior);prior=now;if(times.length<120)requestAnimationFrame(frame);else{const total=times.reduce((a,b)=>a+b,0);times.sort((a,b)=>a-b);resolve({fps:120000/total,p95:times[113],p99:times[118],heap:performance.memory?.usedJSHeapSize,longTasks:window.longTasks});}}
requestAnimationFrame(frame);
}));
results.push({mobile,cold,offline,frames});await context.close();
}
console.log(JSON.stringify(results));
}finally{await browser.close();server.closeAllConnections();server.close();}
