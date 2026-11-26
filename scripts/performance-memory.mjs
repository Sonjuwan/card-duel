import {once} from 'node:events';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

const root=resolve(process.argv[2]??'.');
const cycles=Number(process.argv[3]??24);
if(!Number.isSafeInteger(cycles)||cycles<1)throw Error('Cycle count must be a positive integer.');
const sampleInterval=Math.ceil(cycles/4);
const {createSoloAppServer}=await import(pathToFileURL(root+'/apps/cli/serve-solo-app.mjs'));
const server=createSoloAppServer(root+'/dist/solo-app');
server.listen(0,'127.0.0.1');
await once(server,'listening');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
try{
  const context=await browser.newContext({viewport:{width:780,height:360},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const cdp=await context.newCDPSession(page);
  const menu=page.getByRole('button',{name:'대전',exact:true});
  const recordsButton=page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기'});
  const records=page.getByRole('dialog',{name:'슬롯 · 성장 · 저장 경기'});
  async function openRecords(){
    if(await menu.isVisible())await menu.click();
    await recordsButton.click();
  }
  async function sample(cycles){
    const deadline=Date.now()+5000;
    while(page.workers().length&&Date.now()<deadline)await delay(100);
    await cdp.send('HeapProfiler.collectGarbage');
    const heap=await cdp.send('Runtime.getHeapUsage');
    const dom=await cdp.send('Memory.getDOMCounters');
    return {cycles,jsHeapBytes:heap.usedSize,...dom,workers:page.workers().length};
  }
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await menu.waitFor();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const results=[await sample(0)];
  for(let cycle=1;cycle<=cycles;cycle++){
    await openRecords();
    if(cycle===1)await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).click();
    else await records.getByRole('button',{name:'이어하기',exact:true}).click();
    await page.getByRole('heading',{name:'첫 손패를 선택하세요'}).waitFor();
    await page.getByText('자동 저장됨',{exact:true}).waitFor();
    await page.getByRole('button',{name:'저장 후 나가기'}).click();
    await recordsButton.waitFor();
    await page.waitForFunction(()=>!document.querySelector('.duel-screen'));
    if(cycle%sampleInterval===0||cycle===cycles)results.push(await sample(cycle));
  }
  console.log(JSON.stringify(results));
}finally{
  await browser.close();
  server.closeAllConnections();
  server.close();
}
