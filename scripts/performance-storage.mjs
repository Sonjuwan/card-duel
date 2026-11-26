import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {chromium} from 'playwright';

const root=resolve(process.argv[2]??'.');
const {createSoloAppServer}=await import(pathToFileURL(root+'/apps/cli/serve-solo-app.mjs'));
const server=createSoloAppServer(root+'/dist/solo-app');
server.listen(0,'127.0.0.1');
await once(server,'listening');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
try{
  const context=await browser.newContext({viewport:{width:780,height:360},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;
    window.turnAcknowledgments=[];
    Worker.prototype.postMessage=function(message,...rest){
      if(message.type==='start')message={
        ...message,input:{...message.input,seed:10,deckSeed:123,animationSpeed:'instant'}
      };
      if(message.type==='act'&&message.action.type==='endTurn'){
        const start=performance.now();
        const receive=event=>{
          if(event.data?.requestId!==message.requestId||event.data?.type!=='view')return;
          window.turnAcknowledgments.push(performance.now()-start);
          this.removeEventListener('message',receive);
        };
        this.addEventListener('message',receive);
      }
      return post.call(this,message,...rest);
    };
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.getByRole('button',{name:'대전',exact:true}).click();
  await page.getByRole('button',{name:'슬롯 · 성장 · 저장 경기'}).click();
  await page.getByRole('button',{name:'솔로 랭크 대전 시작'}).click();
  await page.locator('.mulligan-confirm').click();
  await page.locator('.end-turn.your-turn').waitFor();
  const workers=page.workers();
  if(workers.length!==1)throw Error('Expected one active battle worker.');
  const [worker]=workers;
  await worker.evaluate(()=>{
    const transaction=IDBDatabase.prototype.transaction;
    globalThis.writeTimes=[];
    globalThis.putCounts={matches:0,growth:0};
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){
      if(Object.hasOwn(globalThis.putCounts,this.name))globalThis.putCounts[this.name]++;
      return put.apply(this,args);
    };
    IDBDatabase.prototype.transaction=function(stores,mode,options){
      const start=performance.now();
      const result=transaction.call(this,stores,mode,options);
      if(mode==='readwrite'&&Array.from(result.objectStoreNames).includes('matches')){
        result.addEventListener('complete',()=>globalThis.writeTimes.push(performance.now()-start),{once:true});
      }
      return result;
    };
  });
  for(let turn=0;turn<5;turn++){
    await page.locator('.end-turn.your-turn').click();
    await page.waitForFunction(count=>window.turnAcknowledgments.length===count,turn+1);
    await page.locator('.end-turn.your-turn').waitFor();
  }
  console.log(JSON.stringify({
    endTurnWorkerAcknowledgmentMs:await page.evaluate(()=>window.turnAcknowledgments),
    indexedDbWriteMs:await worker.evaluate(()=>globalThis.writeTimes),
    indexedDbPutCounts:await worker.evaluate(()=>globalThis.putCounts)
  }));
}finally{
  await browser.close();
  server.closeAllConnections();
  server.close();
}
