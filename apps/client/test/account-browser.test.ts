import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {LocalAccountStore} from '../../server/account-store.ts';
import {createDuelServer,loadCatalog} from '../../server/server.ts';
import {buildGrowth} from '../../../packages/progression.ts';
import type {AccountBackend} from '../../server/account-store.ts';
import type {AccountView} from '../../../packages/account-protocol.ts';

test('browser: desktop registration, mobile login and shared deck, account-only ranked lobby',{timeout:60000},async()=>{
  const catalog=loadCatalog(),growth=buildGrowth(catalog),accounts=new LocalAccountStore(':memory:',growth);
  const backend:AccountBackend=accounts,register=backend.register.bind(backend);backend.register=(email,password)=>email==='pending@example.test'?Promise.resolve({verificationRequired:true}):register(email,password);
  const {http,io}=createDuelServer(catalog,{accounts,growth});http.listen(0,'127.0.0.1');await once(http,'listening');const addr=http.address();assert.ok(addr&&typeof addr==='object');const url=`http://127.0.0.1:${addr.port}`;
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  let releaseEdit:()=>void=()=>{};
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
    const desktop=await browser.newContext({viewport:{width:1366,height:768}}),mobile=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    const a=await desktop.newPage(),b=await mobile.newPage();const errors:string[]=[];for(const page of [a,b])page.on('pageerror',error=>errors.push(error.message));
    await Promise.all([a.goto(url),b.goto(url)]);
    for(const page of [a,b]){await page.getByText('서버 연결됨').waitFor();await page.getByRole('button',{name:'대전',exact:true}).click();await page.getByRole('button',{name:'계정',exact:true}).click();await page.locator('.account-panel>summary').click();await page.getByRole('textbox',{name:'이메일'}).fill('browser@example.test');await page.getByLabel('비밀번호',{exact:true}).fill('test-password');}
    await a.getByRole('textbox',{name:'이메일'}).fill('pending@example.test');await a.getByRole('button',{name:'새 계정 등록'}).click();
    await a.getByText(/이메일 확인 대기 중/).waitFor();assert.equal(await a.getByLabel('비밀번호',{exact:true}).inputValue(),'');assert.equal(await a.getByRole('button',{name:'랭크 AI 대전 시작'}).count(),0);assert.equal((await desktop.cookies()).some(cookie=>cookie.name==='duel_account'),false);
    await a.getByRole('textbox',{name:'이메일'}).fill('browser@example.test');await a.getByLabel('비밀번호',{exact:true}).fill('test-password');
    await a.getByRole('button',{name:'새 계정 등록'}).click();await a.getByText('계정 등록 완료',{exact:true}).waitFor();
    await a.getByLabel('서버 덱 이름').fill('연동 테스트');await a.getByRole('button',{name:'현재 덱 저장'}).click();await a.getByText('서버 덱 저장 완료').waitFor();
    await b.getByRole('button',{name:'로그인',exact:true}).click();await b.getByText('로그인 완료',{exact:true}).waitFor();await b.getByText('연동 테스트',{exact:true}).waitFor();
    await b.getByText('서버 연결됨').waitFor();await b.locator('.account-panel>summary').click();assert.equal(await b.locator('.account-panel').evaluate(element=>(element as HTMLDetailsElement).open),false);
    await a.getByLabel('서버 덱 이름').fill('실시간 동기화');await a.getByRole('button',{name:'현재 덱 저장'}).click();await b.getByText('실시간 동기화',{exact:true}).waitFor({state:'attached'});assert.equal(await b.locator('.account-panel').evaluate(element=>(element as HTMLDetailsElement).open),false);
    await b.locator('.account-panel>summary').click();await b.getByText('실시간 동기화',{exact:true}).waitFor();
    for(const page of [a,b])await page.getByRole('dialog',{name:'계정',exact:true}).getByRole('button',{name:'닫기',exact:true}).click();
    await a.locator('.hero-gallery').getByRole('button',{name:'마법사'}).click();await b.locator('.hero-gallery').getByRole('button',{name:'전사'}).click();
    for(const page of [a,b])await page.getByRole('button',{name:'계정',exact:true}).click();
    await a.getByLabel('서버 덱 이름').fill('PC 별도 덱');await b.getByLabel('서버 덱 이름').fill('모바일 별도 덱');
    await Promise.all([a,b].map(page=>page.getByRole('button',{name:'현재 덱 저장'}).click()));
    for(const page of [a,b])for(const name of ['PC 별도 덱','모바일 별도 덱'])await page.getByText(name,{exact:true}).waitFor();
    let requestArrived!:()=>void;const arrived=new Promise<void>(resolve=>requestArrived=resolve),release=new Promise<void>(resolve=>releaseEdit=resolve);
    await b.route('**/api/account/deck',async route=>{requestArrived();await release;await route.continue();},{times:1});
    await b.getByLabel('서버 덱 이름').fill('동시 충돌');await b.getByRole('button',{name:'현재 덱 저장'}).click();await arrived;
    await a.getByLabel('서버 덱 이름').fill('동시 충돌');await a.getByRole('button',{name:'현재 덱 저장'}).click();await a.getByText('동시 충돌',{exact:true}).waitFor();releaseEdit();
    await b.getByText(/다른 기기의 변경 내용을 불러왔습니다/).waitFor();await b.getByText('현재 선택한 덱 · 전사',{exact:true}).waitFor();assert.equal(await b.getByLabel('서버 덱 이름').inputValue(),'동시 충돌');
    const profile=await b.evaluate(async()=>(await fetch('/api/account/me')).json() as Promise<AccountView>);assert.equal(profile.profile.decks.find(item=>item.name==='동시 충돌')?.deck.heroClass,'mage');
    await b.getByRole('heading',{name:'오리지널 보상의 길'}).waitFor();
    assert.equal(profile.profile.ownedCards.length,133);
    await b.getByRole('button',{name:'퀘스트 직업 기본 덱'}).click();await b.getByRole('button',{name:'랭크 AI 대전 시작'}).waitFor();
    assert.ok(await b.getByRole('button',{name:'랭크 AI 대전 시작'}).isEnabled());assert.equal(await b.getByRole('button',{name:'서버 패치·운영 상태 확인'}).count(),0);
    await b.getByRole('button',{name:'랭크 AI 대전 시작'}).click();await b.getByText('시작 카드 선택',{exact:true}).waitFor();
    await a.getByText(/기존 계정 대전 · 랭크 AI/).waitFor();assert.equal(await a.getByRole('button',{name:'랭크 AI 대전 시작'}).isEnabled(),false);
    await a.getByRole('button',{name:'다른 기기 대전 이어하기'}).click();await a.getByText('시작 카드 선택',{exact:true}).waitFor();
    assert.deepEqual(errors,[]);
  }finally{releaseEdit();await browser?.close();await io.close();accounts.close();}
});
