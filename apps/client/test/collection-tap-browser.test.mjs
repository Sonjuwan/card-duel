import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';

test('mobile catalog and deck builder keep eight-card pages and read-only inspection distinct from addition',{timeout:120000},async t=>{
  const server=createSoloAppServer();
  server.prependListener('request',req=>{if(req.url?.startsWith('/ui-preview/'))req.url=req.url.slice('/ui-preview'.length);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/ui-preview/');
  await page.getByRole('button',{name:'슬롯 1 선택',exact:true}).tap();
  await page.getByRole('button',{name:'카드 도감',exact:true}).tap();
  const catalog=page.locator('.integrated-browser'),cards=catalog.locator('.collection-book .battle-card');
  await cards.first().waitFor();
  assert.equal(await catalog.locator('.collection-book').getAttribute('data-book-size'),'8');
  const filter=catalog.getByRole('button',{name:'카드 필터',exact:true});
  await filter.tap();
  const filterDialog=page.getByRole('dialog',{name:'카드 필터',exact:true});
  await filterDialog.waitFor();await filterDialog.getByRole('button',{name:'닫기',exact:true}).tap();
  await cards.first().tap();
  const detail=page.getByRole('dialog',{name:'카드 확대 상세'});
  await detail.waitFor();
  assert.equal(await detail.getByRole('button',{name:'덱에 추가',exact:true}).count(),0);
  await detail.getByRole('button',{name:'닫기',exact:true}).tap();
  await page.getByRole('button',{name:'메인으로',exact:true}).tap();
  await page.getByRole('button',{name:'대전',exact:true}).tap();
  await page.getByRole('button',{name:'전사',exact:true}).tap();
  await page.getByRole('button',{name:'＋ 새 덱 만들기 / 편집',exact:true}).tap();
  await page.getByRole('button',{name:'＋ 새 덱 만들기',exact:true}).tap();
  const builder=page.locator('.deck-builder'),count=builder.locator('.deck-live-count');
  await count.waitFor();
  assert.equal(await count.textContent(),'0/30');
  const card=builder.locator('.collection-book .battle-card').first();
  await card.tap();await detail.waitFor();
  assert.equal(await count.textContent(),'0/30','inspection must not add a card');
  await detail.getByRole('button',{name:'덱에 추가',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('.deck-live-count')?.textContent==='1/30');
  await detail.getByRole('button',{name:'닫기',exact:true}).tap();
  for(const [width,height] of [[667,375],[844,390],[1024,600]]){
    await page.setViewportSize({width,height});
    const geometry=await page.evaluate(()=>{
      const book=document.querySelector('.deck-builder .collection-book');
      const rect=book.getBoundingClientRect();
      const cards=[...book.querySelectorAll('.battle-card')].map(el=>el.getBoundingClientRect());
      return {count:cards.length,overflow:cards.some(c=>c.left<rect.left-2||c.right>rect.right+2||c.bottom>rect.bottom+2),documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight};
    });
    assert.ok(geometry.count>0&&geometry.count<=8,JSON.stringify(geometry));
    assert.equal(geometry.overflow,false,JSON.stringify({width,height,...geometry}));
    assert.ok(geometry.documentWidth<=width+2&&geometry.documentHeight<=height+2,JSON.stringify(geometry));
  }
  assert.deepEqual(errors,[]);
});
