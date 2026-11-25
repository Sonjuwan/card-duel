import {readFileSync} from 'node:fs';
import {createCatalog} from '../packages/engine/src/index.ts';

const directory=new URL('../data/cards/',import.meta.url);
const {file}=JSON.parse(readFileSync(new URL('active.json',directory),'utf8'));
const cards=Object.values(createCatalog(JSON.parse(readFileSync(new URL(file,directory),'utf8'))));
const effects=card=>[
  ...(card.effects??[]),...(card.battlecry??[]),...(card.combo??[]),...(card.deathrattle??[]),
  ...(card.startTurn??[]),...(card.endTurn??[]),...(card.endAnyTurn??[]),
  ...(card.choices??[]).flatMap(option=>option.effects),
];
const targeted=card=>Boolean(card.targetRule||card.choices?.some(option=>option.targetRule));
const groups=new Map([
  ['선택형',card=>Boolean(card.choices)],
  ['대상 지정 전투의 함성과 연계 하수인',card=>card.kind==='minion'&&targeted(card)],
  ['대상 지정 주문',card=>card.kind==='spell'&&targeted(card)],
  ['대상 없는 전투의 함성',card=>card.kind==='minion'&&Boolean(card.battlecry)&&!targeted(card)],
  ['일반 하수인',card=>card.kind==='minion'&&!card.battlecry&&!card.combo&&!card.choices],
  ['광역 효과',card=>effects(card).some(effect=>/^(all|friendlyMinions|enemyMinions|otherFriendlyMinions|otherMinions)/.test(effect.target??'')||effect.kind==='damageSplash')],
  ['죽음의 메아리',card=>Boolean(card.deathrattle?.length)],
  ['턴 시작·종료',card=>Boolean(card.startTurn?.length||card.endTurn?.length||card.endAnyTurn?.length)],
  ['지속 효과·오라',card=>Boolean(card.auras?.length||card.costAuras?.length||card.spellDamage)],
  ['조건·연계',card=>Boolean(card.combo||effects(card).some(effect=>effect.condition))],
  ['소환·토큰 효과',card=>effects(card).some(effect=>effect.kind.startsWith('summon'))],
  ['무기',card=>card.kind==='weapon'],
  ['비밀',card=>card.kind==='secret'],
]);
const known=[...groups.values()];
groups.set('기타 구현 카드',card=>!known.some(includes=>includes(card)));
console.log('# 활성 카탈로그 메커니즘 검사\n');
console.log(`카탈로그 \`${file}\` 및 엔진 토큰 총 ${cards.length}종. 한 카드가 여러 분류에 포함될 수 있습니다.\n`);
console.log('목록은 `node scripts/report-card-mechanisms.mjs`로 다시 생성합니다. 카드별 대상 지정·선택형 회귀 검사는 `node --test packages/engine/test/target-mechanisms.test.ts`에서 실행합니다.\n');
for(const [label,includes] of groups){
  const matched=cards.filter(includes);
  console.log(`## ${label} · ${matched.length}종\n`);
  console.log(matched.map(card=>`${card.name} (\`${card.id}\`)`).join(' · ')+'\n');
}
