import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { createDuelServer,loadCatalog } from '../../server/server.ts';
import { CardStore } from '../../server/card-store.ts';
import { createAdminServer } from '../../admin/admin-server.ts';
import { createCatalog } from '../../../packages/engine/src/index.ts';
import { copyFileSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('browser: offline artwork and maximum hand stay inside the tabletop at desktop sizes',{timeout:30000},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage();const external:string[]=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  try{
    const html=readFileSync(new URL('../../../interface-preview.html',import.meta.url),'utf8');
    for(const [width,height] of [[1366,768],[1920,1080]]){
      await page.setViewportSize({width,height});await page.setContent(html);
      const arena=page.locator('#full-board .classic-table');
      const cards=arena.locator('.battle-hand .battle-card');
      assert.equal(await cards.count(),10);assert.equal(await cards.locator('.painted-art').count(),10);
      const bounds=await arena.boundingBox();assert.ok(bounds);
      const field=await arena.locator('.arena-field').boundingBox();assert.ok(field);
      for(const side of ['enemy-board','friendly-board']){
        const board=arena.locator('.'+side),boardBounds=await board.boundingBox();assert.ok(boardBounds);
        assert.ok(boardBounds.height>=field.height*.23,'expanded battlefield row');
        const units=await board.locator('.battle-minion').all();assert.equal(units.length,7);
        let right=boardBounds.x;
        for(const unit of units){
          const u=await unit.boundingBox();assert.ok(u);assert.ok(u.x>=right-1,'no horizontal overlap');right=u.x+u.width;
          assert.ok(u.x>=boardBounds.x-1&&right<=boardBounds.x+boardBounds.width+1&&u.y>=boardBounds.y-1&&u.y+u.height<=boardBounds.y+boardBounds.height+1,'minion remains within row');
          const art=await unit.locator('.minion-medallion').boundingBox();assert.ok(art);assert.ok(art.width>=90&&Math.abs(art.width-art.height)<=2,'larger square battlefield illustration');
          assert.equal(await unit.locator('.painted-art').evaluate(e=>getComputedStyle(e).backgroundSize),'contain');
        }
      }
      for(const card of await cards.all()){
        const b=await card.boundingBox();assert.ok(b);
        assert.ok(b.x>=bounds.x-1&&b.x+b.width<=bounds.x+bounds.width+1,'card inside tabletop horizontally');
        assert.ok(b.y+b.height<=bounds.y+bounds.height+1,'card bottom is not clipped');
      }
      // Inspect untransformed sizes because hand cards are intentionally rotated.
      for(const card of await page.locator('#full-board .battle-hand .battle-card, #deck .collection-item .battle-card, #mulligan .mulligan-cards .battle-card, #hover-card .hover-large-card').all()){
        const geometry=await card.evaluate(el=>{
          const art=el.querySelector<HTMLElement>('.card-art')!,name=el.querySelector<HTMLElement>('.card-name')!,stats=el.querySelector<HTMLElement>('.card-statline')!;
          return {width:art.offsetWidth,height:art.offsetHeight,artTop:art.offsetTop, nameTop:name.offsetTop,statsBottom:stats.offsetTop+stats.offsetHeight,cardHeight:(el as HTMLElement).offsetHeight,fit:getComputedStyle(art.querySelector('.painted-art')!).backgroundSize};
        });
        assert.ok(geometry.width>20&&Math.abs(geometry.width-geometry.height)<=2,'portrait is square');
        assert.equal(geometry.fit,'contain','whole painting is preserved');
        assert.ok(geometry.nameTop>=geometry.artTop+geometry.height-2,'title must not overlap painting');
        assert.ok(geometry.statsBottom<=geometry.cardHeight+3,'stats remain inside the card frame');
      }
      assert.equal(await arena.locator('img').count(),0);
    }
    assert.deepEqual(external,[]);
    await page.clock.install();
    const hand=page.locator('#battle .battle-hand .battle-card').first(),popup=page.locator('body > .card-hover-panel');
    await hand.hover();await page.clock.runFor(700);assert.equal(await popup.count(),0);
    await page.clock.runFor(350);await popup.waitFor();assert.match(await popup.locator('.painted-art').evaluate(el=>getComputedStyle(el).backgroundImage),/data:image\/webp/);
    await page.mouse.move(1,1);await popup.waitFor({state:'detached'});
    await page.locator('#battle .friendly-board .battle-minion').first().hover();await page.clock.runFor(1000);await popup.waitFor();assert.match(await popup.innerText(),/전장 능력치/);await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});
    await page.locator('#battle .enemy-board .battle-minion').first().hover();await page.clock.runFor(1000);await popup.waitFor();assert.match(await popup.innerText(),/전장 능력치/);
    await page.mouse.move(1,1);await popup.waitFor({state:'detached'});
  }finally{await browser.close();}
});
test('browser: two independent players build a deck, join, mulligan, take turns and concede',{timeout:60000},async(t)=>{
  const {http,io}=createDuelServer(loadCatalog('v0.8.0.json'));http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');
  t.after(async()=>{await io.close();});
  const url=`http://127.0.0.1:${address.port}`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const contextA=await browser.newContext(),contextB=await browser.newContext();const a=await contextA.newPage(),b=await contextB.newPage();
  const errors:string[]=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
  try{
    await Promise.all([a.goto(url),b.goto(url)]);
    await Promise.all([a.getByText('서버 연결됨').waitFor(),b.getByText('서버 연결됨').waitFor()]);
    await a.getByRole('button',{name:'덱 편집하기',exact:true}).click();await a.getByRole('button',{name:'덱 만들기',exact:true}).click();await a.getByRole('button',{name:'비우기',exact:true}).click();await a.getByText('0/30장',{exact:true}).waitFor();await a.getByRole('button',{name:'대전 준비로 돌아가기'}).click();assert.ok(await a.getByRole('button',{name:'새 방 만들기'}).isDisabled());await a.getByRole('button',{name:'덱 편집하기',exact:true}).click();await a.getByRole('button',{name:'덱 만들기',exact:true}).click();
    await a.getByRole('button',{name:'빈칸 자동 채우기'}).click();await a.getByText('30/30장',{exact:true}).waitFor();await a.getByRole('button',{name:'되돌리기',exact:true}).click();await a.getByText('0/30장',{exact:true}).waitFor();await a.reload();await a.getByText('서버 연결됨').waitFor();await a.getByRole('button',{name:'덱 편집하기',exact:true}).click();await a.getByRole('button',{name:'덱 만들기',exact:true}).click();await a.getByText('0/30장',{exact:true}).waitFor();
    await a.getByRole('button',{name:'추천 덱',exact:true}).click();await a.getByText('30/30장').waitFor();
    await a.getByPlaceholder('저장할 덱 이름').fill('테스트 덱');await a.getByRole('button',{name:'덱 저장',exact:true}).click();await a.getByText('덱 저장 완료').waitFor();
    await a.getByRole('button',{name:'비우기',exact:true}).click();await a.getByRole('button',{name:'덱 리스트',exact:true}).click();await a.getByRole('button',{name:'불러오기',exact:true}).click();await a.getByText('30/30장').waitFor();
    await a.getByRole('button',{name:'대전 준비로 돌아가기'}).click();await a.getByRole('button',{name:'새 방 만들기'}).click();await a.getByText('친구를 기다리는 중').waitFor();const code=(await a.locator('.room-code').textContent())!;assert.match(code,/^[A-Z2-9]{6}$/);
    await b.getByRole('button',{name:'마법사',exact:true}).click();await b.getByPlaceholder('6자리 방 코드').fill(code);await b.getByRole('button',{name:'참가',exact:true}).click();
    await Promise.all([a.getByRole('heading',{name:'시작 카드 선택'}).waitFor(),b.getByRole('heading',{name:'시작 카드 선택'}).waitFor()]);
    await a.getByRole('button',{name:/확정/}).click();await a.getByText('상대의 선택을 기다리는 중입니다.').waitFor();
    await b.getByRole('button',{name:/확정/}).click();await a.getByRole('button',{name:'턴 종료'}).waitFor();
    await a.waitForFunction(()=>document.querySelector('.battle h2')?.textContent?.includes('턴'));
    const first=(await a.getByRole('heading',{name:'내 턴',exact:true}).count())===1?a:b;const second=first===a?b:a;
    await first.getByRole('heading',{name:'내 턴',exact:true}).waitFor();await first.getByRole('button',{name:'턴 종료'}).click();await second.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    await second.reload();await second.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    second.once('dialog',d=>d.accept());await second.getByRole('button',{name:'항복',exact:true}).click();await first.getByRole('heading',{name:'승리!',exact:true}).waitFor();await second.getByRole('heading',{name:'패배',exact:true}).waitFor();assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
test('browser: start a solo AI match, mulligan, finish a turn and concede',{timeout:60000},async(t)=>{
  const {http,io}=createDuelServer(loadCatalog(),{botDelayMs:75});http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');
  t.after(async()=>{await io.close();});
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(`http://127.0.0.1:${address.port}`);await page.getByText('서버 연결됨').waitFor();
    await page.getByLabel('AI 직업',{exact:true}).selectOption('hunter');await page.getByLabel('AI 난이도',{exact:true}).selectOption('5');await page.getByRole('button',{name:'AI 대전 시작'}).click();
    await page.getByText(/AI 대전 · 5단계 전문가/).waitFor();
    await page.getByRole('heading',{name:'시작 카드 선택'}).waitFor();await page.getByRole('button',{name:/확정/}).click();
    await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();await page.getByText('AI · 사냥꾼',{exact:true}).waitFor();
    await page.getByRole('button',{name:'턴 종료'}).click();await page.getByRole('heading',{name:'AI 턴',exact:true}).waitFor();await page.getByRole('heading',{name:'내 턴',exact:true}).waitFor();
    page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'항복'}).click();await page.getByRole('heading',{name:'패배',exact:true}).waitFor();assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
test('browser: full catalogue filters, mana curve, sharing and explicit legacy deck recovery',{timeout:60000},async(t)=>{
  const {http,io}=createDuelServer(loadCatalog('v0.19.0.json'));http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');t.after(async()=>{await io.close();});
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(`http://127.0.0.1:${address.port}`);await page.getByText('서버 연결됨').waitFor();await page.getByRole('button',{name:'덱 편집하기',exact:true}).click();await page.getByRole('button',{name:/마법사\s*140종/}).click();await page.getByRole('button',{name:'추천 덱 만들기',exact:true}).click();await page.getByText('140/140종').waitFor();
    await page.getByRole('button',{name:/^기본 카드\s*\d+$/}).click();assert.equal(await page.locator('.classic-collection .battle-card:not(.rarity-basic)').count(),0);
    await page.getByRole('button',{name:/^오리지널 카드\s*\d+$/}).click();assert.equal(await page.locator('.classic-collection .battle-card.rarity-basic').count(),0);
    await page.getByRole('button',{name:'필터 초기화'}).click();await page.getByText('182/182종').waitFor();
    await page.getByLabel('카드 종류',{exact:true}).selectOption('secret');await page.getByLabel('카드 등급',{exact:true}).selectOption('rare');await page.getByText('2/182종').waitFor();await page.getByPlaceholder('카드 이름 또는 효과 검색').fill('마력 차단막');await page.getByText('1/182종').waitFor();await page.getByRole('searchbox',{name:'카드 이름 또는 효과 검색'}).fill('차단막 마력');await page.getByText('1/182종').waitFor();await page.getByRole('searchbox',{name:'카드 이름 또는 효과 검색'}).fill('마력차단막');await page.getByText('1/182종').waitFor();
    await page.getByText('친구와 덱 공유하기',{exact:true}).click();await page.getByRole('button',{name:'공유 코드 만들기'}).click();const code=await page.getByLabel('덱 공유 코드').inputValue();assert.equal(JSON.parse(code).cards.length,30);await page.getByRole('button',{name:'비우기',exact:true}).click();await page.getByText('0/30장').waitFor();await page.getByRole('button',{name:'공유 코드 불러오기'}).click();await page.getByText('30/30장').waitFor();assert.equal(await page.locator('.mana-curve>div').count(),11);
    await page.evaluate(()=>localStorage.setItem('card-duel-saved-decks',JSON.stringify([{name:'이전 덱',deck:{heroClass:'mage',cards:['wolf','wolf',...Array(28).fill('golem')]}}])));await page.reload();await page.getByText('서버 연결됨').waitFor();await page.getByRole('button',{name:'덱 편집하기',exact:true}).click();await page.getByRole('button',{name:'덱 리스트',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'불러오기',exact:true}).click();await page.getByText('2/30장').waitFor();assert.match(await page.evaluate(()=>localStorage.getItem('card-duel-saved-decks')??''),/golem/);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
test('browser: drag a card to the battlefield, drag attack to enemy hero, and keep the table within the viewport',{timeout:60000},async(t)=>{
  const cards=Array.from({length:15},(_,i)=>({id:`test_soldier_${i}`,name:`테스트 병사 ${i+1}`,kind:'minion',class:'neutral',rarity:'basic',cost:0,attack:2,health:2,tribe:'none',description:''}));
  const {http,io}=createDuelServer(createCatalog(cards));http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');t.after(async()=>{await io.close();});
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});const ca=await browser.newContext({viewport:{width:1366,height:768}}),cb=await browser.newContext({viewport:{width:1366,height:768}});const a=await ca.newPage(),b=await cb.newPage();const errors:string[]=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
  try{
    const url=`http://127.0.0.1:${address.port}`;await Promise.all([a.goto(url),b.goto(url)]);await Promise.all([a.getByText('서버 연결됨').waitFor(),b.getByText('서버 연결됨').waitFor()]);await a.getByRole('button',{name:'새 방 만들기'}).click();await a.getByText('친구를 기다리는 중').waitFor();const code=(await a.locator('.room-code').textContent())!;await b.getByPlaceholder('6자리 방 코드').fill(code);await b.getByRole('button',{name:'참가',exact:true}).click();await Promise.all([a.getByRole('heading',{name:'시작 카드 선택'}).waitFor(),b.getByRole('heading',{name:'시작 카드 선택'}).waitFor()]);
    await a.locator('.mulligan-cards .battle-card').first().click();assert.equal(await a.locator('.replace-banner').count(),1);await a.getByRole('button',{name:/확정/}).click();await b.getByRole('button',{name:/확정/}).click();await Promise.all([a.locator('.battle-arena').waitFor(),b.locator('.battle-arena').waitFor()]);
    const first=(await a.getByRole('heading',{name:'내 턴',exact:true}).count())?a:b;const second=first===a?b:a;const card=first.locator('.battle-hand .battle-card.kind-minion.is-ready').first();await card.waitFor();await card.hover();await first.locator('body > .card-hover-panel').waitFor();await first.keyboard.press('Escape');await first.locator('body > .card-hover-panel').waitFor({state:'detached'});await card.click();const selected=first.locator('.battle-hand .battle-card.is-selected');await selected.waitFor();assert.equal(await first.locator('.friendly-board .battle-minion').count(),0);assert.equal(await second.locator('.enemy-board .battle-minion').count(),0);await selected.dragTo(first.locator('.position-slot').first());await Promise.all([first.locator('[data-fx-kind="summon"][data-fx-side="own"]').waitFor(),second.locator('[data-fx-kind="summon"][data-fx-side="enemy"]').waitFor()]);await first.locator('.friendly-board .battle-minion').waitFor();await second.locator('.enemy-board .battle-minion').waitFor();assert.equal(await first.locator('.friendly-board .battle-minion').count(),1);
    for(const [page,selector] of [[first,'.friendly-board .battle-minion'],[second,'.enemy-board .battle-minion']] as const){await page.locator(selector).first().hover();const popup=page.locator('body > .card-hover-panel');await popup.waitFor();assert.match(await popup.innerText(),/전장 능력치/);assert.equal(await popup.locator('.stat-attack').textContent(),'2');await page.mouse.move(1,1);await popup.waitFor({state:'detached'});}
    await second.locator('.hidden-hand .card-back').first().hover();await second.waitForTimeout(1100);assert.equal(await second.locator('body > .card-hover-panel').count(),0);
    await first.getByRole('button',{name:'턴 종료'}).click();await second.getByRole('heading',{name:'내 턴',exact:true}).waitFor();await second.getByRole('button',{name:'턴 종료'}).click();await first.getByRole('heading',{name:'내 턴',exact:true}).waitFor();await first.locator('.friendly-board .battle-minion.is-ready').dragTo(first.locator('.enemy-hero-zone .hero-portrait'));await Promise.all([first.locator('[data-fx-kind="attack"][data-fx-side="own"]').waitFor(),second.locator('[data-fx-kind="attack"][data-fx-side="enemy"]').waitFor()]);await first.locator('.enemy-hero-zone .hero-health').filter({hasText:'28'}).waitFor();await second.locator('.self-hero-zone .hero-health').filter({hasText:'28'}).waitFor();
    const end=await first.locator('.end-turn').boundingBox();assert.ok(end&&end.y+end.height<=768);assert.ok(await first.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await first.setViewportSize({width:390,height:844});assert.ok(await first.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
test('browser: balance editor numeric change, validation, clone, comparison and rollback',{timeout:60000},async(t)=>{
  const dir=mkdtempSync(join(tmpdir(),'duel-admin-browser-'));copyFileSync(new URL('../../../data/cards/v0.19.0.json',import.meta.url),join(dir,'v0.19.0.json'));writeFileSync(join(dir,'active.json'),'{"file":"v0.19.0.json"}');const store=new CardStore(dir),admin=createAdminServer(store);admin.listen(0,'127.0.0.1');await once(admin,'listening');const address=admin.address();assert.ok(address&&typeof address==='object');t.after(async()=>{await new Promise<void>(resolve=>admin.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});});
  const previous=readFileSync(join(dir,'v0.19.0.json')),browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(`http://127.0.0.1:${address.port}`);await page.getByText('332/332종').waitFor();await page.locator('#search').fill('flame_sphere');await page.locator('#effect-numbers input').first().fill('7');await page.getByRole('button',{name:'저장 전 검사'}).click();await page.getByText(/검사 통과/).waitFor();assert.equal(store.read().version,'v0.19.0.json');
    await page.getByRole('button',{name:'현재 초안의 카드 수치 분석'}).click();await page.getByText(/카드 수치 분석 완료/).waitFor();await page.locator('#analysis-filter').selectOption('changed');assert.equal(await page.locator('#analysis-rows tr').count(),1);
    await page.locator('#lab-level').selectOption('6');await page.locator('#lab-focus').check();await page.getByRole('button',{name:'AI 밸런스 시험 시작'}).click();await page.getByText(/시험 중 · 원본/).waitFor();await page.getByRole('button',{name:'시험 중단',exact:true}).click();await page.getByText(/시험 중단 · 원본/).waitFor();assert.equal(store.read().version,'v0.19.0.json');
    await page.getByRole('button',{name:'새 버전 저장 및 활성화'}).click();await page.getByText(/저장 완료/).waitFor();const current=store.read();assert.notEqual(current.version,'v0.19.0.json');assert.deepEqual(readFileSync(join(dir,'v0.19.0.json')),previous);const spell=current.catalog.flame_sphere;assert.ok(spell.kind==='spell'&&spell.effects?.[0]?.kind==='damage');assert.equal(spell.effects[0].amount,7);
    await page.getByText('현재 카드 복제해서 새 카드 만들기').click();await page.locator('#new-id').fill('custom_flame');await page.getByRole('button',{name:'새 카드 초안 추가'}).click();await page.getByText(/새 카드 초안을 추가/).waitFor();await page.getByRole('button',{name:'저장 전 검사'}).click();await page.getByText(/309종 덱 카드/).waitFor();await page.getByRole('button',{name:'새 버전 저장 및 활성화'}).click();await page.getByText(/저장 완료/).waitFor();assert.ok(store.read().catalog.custom_flame);
    await page.locator('#versions').selectOption('v0.19.0.json');await page.getByRole('button',{name:'선택 버전과 비교'}).click();await page.getByText(/버전 비교 완료/).waitFor();await page.getByText(/추가 1 \/ 제거 0 \/ 변경 1/).waitFor();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'선택 버전을 활성화'}).click();await page.getByText('이전 버전이 활성화되었습니다.').waitFor();assert.equal(store.read().version,'v0.19.0.json');assert.equal(store.read().catalog.custom_flame,undefined);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
