import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createSoloAppServer} from '../../cli/serve-solo-app.mjs';

test('compiled PC and tablet show eight readable cards, detail preview and live deck controls', {timeout:120000}, async t=>{
  const server=createSoloAppServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const address=server.address();
  assert.ok(address && typeof address==='object');
  const browser=await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  t.after(()=>browser.close());
  mkdirSync('ui-evidence',{recursive:true});
  for(const [label,width,height] of [['pc',1920,1080],['tablet',1024,768]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.goto('http://127.0.0.1:'+address.port+'/');
    await page.getByRole('button',{name:'카드 도감',exact:true}).click();
    await page.locator('.card-browser .collection-book .battle-card').first().waitFor();
    const book=await page.evaluate(()=>{
      const cards=[...document.querySelectorAll('.card-browser .collection-book .battle-card')];
      const rect=cards[0]?.getBoundingClientRect();
      return {
        count:cards.length,
        columns:document.querySelectorAll('.card-browser .collection-leaf').length,
        size:document.querySelector('.card-browser .collection-book')?.getAttribute('data-book-size'),
        width:rect?.width??0,height:rect?.height??0,
        descriptionDisplay:cards[0]&&getComputedStyle(cards[0].querySelector('.card-copy')).display,
        inspector:document.querySelector('.card-browser .collection-inspector-sidebar')?.getBoundingClientRect().width??0,
        viewportWidth:innerWidth,documentWidth:document.documentElement.scrollWidth
      };
    });
    assert.equal(book.count,8,label+' collection count');
    assert.equal(book.size,'8',label+' spread mode');
    assert.equal(book.columns,2,label+' book leaves');
    assert.ok(book.width>=110,label+' card width '+JSON.stringify(book));
    assert.ok(Math.abs(book.width/book.height-1/1.55)<.04,label+' card ratio '+JSON.stringify(book));
    assert.notEqual(book.descriptionDisplay,'none',label+' should show card effect text');
    assert.ok(book.inspector>=150,label+' card details sidebar');
    assert.ok(book.documentWidth<=book.viewportWidth+2,label+' no document horizontal scrolling');
    await page.screenshot({path:'ui-evidence/'+label+'-catalog.png',fullPage:false});
    await page.locator('.card-browser .collection-book .battle-card').first().click();
    await page.locator('dialog.collection-detail-dialog[open] .collection-detail-card .battle-card').waitFor();
    assert.equal(await page.locator('dialog.collection-detail-dialog[open] .card-inspector').count(),1);
    await page.screenshot({path:'ui-evidence/'+label+'-card-detail.png',fullPage:false});
    await page.getByRole('button',{name:'닫기',exact:true}).click();
    await page.getByRole('button',{name:'메인으로'}).click();
    await page.getByRole('button',{name:'덱 만들기',exact:true}).click();
    await page.getByRole('button',{name:'빈 덱 만들기',exact:true}).click();
    await page.locator('.deck-builder .collection-book .battle-card').first().waitFor();
    assert.equal(await page.locator('.deck-builder .collection-book .battle-card').count(),8,label+' deck builder count');
    assert.equal(await page.locator('.deck-builder .deck-sidebar').count(),1,label+' deck list visible');
    const bounds=await page.evaluate(()=>{
      const items=[...document.querySelectorAll('.deck-builder .collection-book .collection-item')];
      const last=items.at(-1)?.getBoundingClientRect();
      const viewport=document.querySelector('.lobby-main>.screen-content')?.getBoundingClientRect();
      return {bottom:last?.bottom??Infinity,availableBottom:viewport?.bottom??innerHeight};
    });
    assert.ok(bounds.bottom<=bounds.availableBottom+2,label+' all eight deck cards must be visible without vertical scroll: '+JSON.stringify(bounds));
    await page.screenshot({path:'ui-evidence/'+label+'-deck-builder.png',fullPage:false});
    await page.locator('.deck-builder .collection-book .battle-card').first().click();
    await page.locator('.deck-builder .game-toast[role=status]').getByText(/1장 추가/).waitFor();
    assert.equal(await page.locator('.deck-builder .deck-live-count').textContent(),'1/30');
    assert.deepEqual(errors,[],label+' no unexpected JS errors');
    await context.close();
  }
});