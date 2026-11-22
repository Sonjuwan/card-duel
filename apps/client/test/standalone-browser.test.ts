import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
test('offline solo full React application works with internet disabled on a phone-size viewport',{timeout:60000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,offline:true});
  const page=await context.newPage(),external:string[]=[],errors:string[]=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(new URL('../../../solo-offline.html',import.meta.url).href);
    await page.getByText('● 오프라인 솔로').waitFor();assert.equal(await page.getByText('친구와 1:1 대전').count(),0);
    await page.getByText('기기 AI 대전은 자동으로 저장됩니다.').waitFor();
    await page.getByLabel('AI 난이도',{exact:true}).selectOption('3');await page.getByLabel('선공·후공',{exact:true}).selectOption('first');await page.getByRole('button',{name:'AI 대전 시작'}).click();
    await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();await page.getByText('자동 저장됨',{exact:true}).waitFor();
    await page.reload();await page.getByRole('button',{name:'이어하기',exact:true}).click();await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();await page.getByRole('button',{name:/확정/}).click();
    await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    await page.getByRole('button',{name:'저장 후 나가기'}).click();await page.getByRole('button',{name:'이어하기',exact:true}).waitFor();await page.getByRole('button',{name:'이어하기',exact:true}).click();await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    const card=page.locator('.battle-hand .battle-card[aria-disabled="false"]').first();
    if(await card.count()){
      await card.tap();await page.getByRole('button',{name:'선택 카드 내기'}).waitFor();assert.equal(await card.getAttribute('aria-pressed'),'true');
      await page.getByRole('button',{name:'선택 취소'}).tap();
    }
    await page.getByRole('button',{name:'턴 종료'}).click();await page.getByRole('heading',{name:'AI 턴',exact:true}).waitFor();await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'항복'}).click();await page.getByRole('heading',{name:'패배',exact:true}).waitFor();
    await page.getByRole('button',{name:'같은 상대와 재대전'}).click();await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
