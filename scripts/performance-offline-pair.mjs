import {chromium} from 'playwright';
import {createSoloAppServer} from '../apps/cli/serve-solo-app.mjs';
import {once} from 'node:events';
const dirs=process.argv.slice(2);
if(dirs.length!==2)throw Error('Usage: node scripts/performance-offline-pair.mjs BASELINE_PWA_DIR CANDIDATE_PWA_DIR');
const servers=dirs.map(path=>createSoloAppServer(path));
for(const server of servers){server.listen(0,'127.0.0.1');await once(server,'listening');}
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
const result=[];
try{
for(let trial=0;trial<6;trial++){
 for(const index of trial%2===0?[0,1]:[1,0]){
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  try{
   const page=await context.newPage(),cdp=await context.newCDPSession(page);
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   await page.goto('http://127.0.0.1:'+servers[index].address().port+'/',{waitUntil:'domcontentloaded'});
   await page.getByRole('navigation',{name:'게임 메뉴'}).waitFor();
   await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   await context.setOffline(true);
   await page.reload({waitUntil:'domcontentloaded'});
   await page.getByRole('navigation',{name:'게임 메뉴'}).waitFor();
   const sample=await page.evaluate(()=>{
    const nav=performance.getEntriesByType('navigation')[0];
    return [performance.now(),nav.responseEnd,nav.domContentLoadedEventEnd];
   });
   result.push({trial,index,sample});
  }finally{await context.close();}
 }
}
console.log(JSON.stringify(result));
}finally{await browser.close();for(const s of servers){s.closeAllConnections();s.close();}}
