import { CardStore } from '../server/card-store.ts';
import { deckCards, HERO_CLASSES, starterDeck, practiceDeck, validateDeck } from '../../packages/engine/src/index.ts';
const {version,cards,catalog}=new CardStore().read();
const collectible=cards.filter(c=>c.collectible!==false);
console.log('Card Duel 활성 카드 검사:',version);
console.log('덱 구성용:',collectible.length,'/ 비수집 정의:',cards.length-collectible.length);
for(const rarity of ['basic','common','rare','epic','legendary'] as const)console.log(rarity,collectible.filter(c=>c.rarity===rarity).length);
for(const kind of ['minion','spell','weapon','secret'] as const)console.log(kind,collectible.filter(c=>c.kind===kind).length);
for(const cls of HERO_CLASSES){
  const legal=deckCards(catalog,cls);const deck=starterDeck(catalog,cls),practice=practiceDeck(catalog,cls);validateDeck(deck,catalog);validateDeck(practice,catalog);
  console.log(cls,legal.length,'편입 가능 / AI 덱',deck.cards.length,'장 / 입문 추천 덱',practice.cards.length,'장 검증 완료');
}
console.log('카드 정의, 효과 데이터 및 모든 직업의 추천 덱 검사 통과. (밸런스의 공정성은 실제 대전으로 평가하세요.)');
