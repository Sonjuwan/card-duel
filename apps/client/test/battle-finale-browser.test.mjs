import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createServer} from 'vite';

test('real lethal damage breaks each portrait before presenting its result',{timeout:60000},async t=>{
  const {file}=JSON.parse(readFileSync('data/cards/active.json','utf8'));
  const raw=readFileSync('data/cards/'+file,'utf8');
  const hash=createHash('sha256').update(raw).digest('hex');
  const server=await createServer({configFile:'apps/client/vite.config.ts',server:{host:'127.0.0.1',port:0},plugins:[{
    name:'card-finale-test',
    configureServer(vite){
      vite.middlewares.use('/test-finale',(req,res)=>{
        res.setHeader('Content-Type','text/html');
        const loser=req.url.includes('own')?0:1;
        res.end(`<!doctype html><meta name="viewport" content="width=device-width"><div id="root"></div><script type="module">import {mountBattleFinale} from '/test/battle-finale-fixture.tsx';mountBattleFinale(${raw},${JSON.stringify(hash)},${loser});</script>`);
      });
    },
  }]});
  await server.listen();
  t.after(()=>server.close());
  const address=server.httpServer.address();
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  mkdirSync('ui-evidence',{recursive:true});
  for(const side of ['own','enemy']){
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    await page.goto('http://127.0.0.1:'+address.port+'/test-finale?side='+side);
    await page.getByRole('button',{name:'최종 피해'}).evaluate(button=>button.click());
    const shards=page.locator('.hero-portrait[data-shattered=true] .hero-shard');
    await shards.first().waitFor();
    assert.equal(await shards.count(),6);
    const result=page.getByRole('dialog',{name:'대전 결과'});
    assert.equal(await result.count(),0);
    await page.waitForTimeout(605);
    await page.screenshot({path:'ui-evidence/finale-'+side+'.png'});
    await result.getByText(side==='own'?'대전 패배':'대전 승리',{exact:true}).waitFor();
    await page.close();
  }
});
