import type {Page} from 'playwright';

export async function chooseBasicDeck(page:Page,className:string){
  await page.locator('.preview-deck-shortcuts').getByRole('button',{name:/^기본 덱/}).click();
  await page.getByRole('region',{name:'기본 덱 직업'}).getByRole('button',{name:className,exact:true}).click();
}

export async function openLegacyPlayOptions(page:Page){
  await page.getByRole('button',{name:'대전',exact:true}).click();
  await chooseBasicDeck(page,'전사');
  await page.getByRole('button',{name:'선택한 덱으로 대전 시작'}).click();
}
