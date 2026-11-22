# 공통 효과 엔진 및 카드 데이터 작성법

이 게임은 카드 효과를 실행 코드가 아닌 JSON 데이터로 선언한다. 모든 카드 데이터는 `createCatalog()`에서 검사된다. 현재 엔진의 유효한 형식/기능만 작성할 수 있다. 밸런스 편집기의 「효과 설정」에서는 카드에 해당하는 아래 필드만 JSON 객체로 입력한다. 카드 설명은 표시용이며 실제 동작을 결정하지 않는다.

## 카드 종류

- `minion`: 비용, 공격력 `attack`, 최대 생명력 `health`, 종족 `tribe`. 선택적으로 키워드, 전투의 함성, 죽음의 메아리, 턴 시작/종료 효과, 지속 강화, 이벤트 트리거, 선택 효과, 격노, 비용 변화 효과를 가질 수 있다.
- `spell`: `effects` 목록 또는 `choices` 목록. `targetRule`이 있으면 대상 선택이 필요하다.
- `weapon`: `attack` 및 `durability`. 영웅 공격 시 내구도 감소, 0에서 파괴. 새 무기 장착 시 기존 무기 대체. `battlecry`(장착 직후), `beforeAttack`(영웅의 공격 직전), `secretRevealed`(아군 비밀 발동 시) 효과를 가질 수 있다. 장착 효과에 `targetRule`을 선언할 수 있다.
- `secret`: `trigger` 및 `effects`; 상대에게는 개수만 보여 주며 발동하면 공개. 최대 5개, 동일 비밀 중복 설치 불가. `enemyAttackHero`, `enemyPlayMinion`, `enemyCastSpell`의 3가지 발동 조건.

희귀도는 `basic`, `common`, `rare`, `epic`; `class`는 9개 직업 ID 또는 `neutral`. 종족 `beast`, `demon`, `dragon`, `murloc`, `pirate`, `totem`, `none`. `collectible:false`인 토큰은 덱에 넣을 수 없다.

## 기본 예시

주문: 적 대상 피해 3.

```json
{"targetRule":"enemyCharacter","effects":[{"kind":"damage","target":"chosen","amount":3}]}
```

하수인: 도발, 죽음의 메아리로 카드 1장 뽑기.

```json
{"keywords":["taunt"],"deathrattle":[{"kind":"draw","amount":1}]}
```

하수인: 야수 시너지(아군 야수 전체 +1/+1).

```json
{"battlecry":[{"kind":"buff","target":"friendlyMinions","tribe":"beast","attack":1,"health":1}]}
```

지속 강화: 다른 아군 해적 공격력 +1.

```json
{"auras":[{"target":"otherFriendlyMinions","tribe":"pirate","attack":1,"health":0}]}
```

## 키워드

| JSON | 구현 |
|---|---|
| `taunt` | 보이는 도발 하수인을 먼저 공격 |
| `charge` | 소환된 턴에도 공격 |
| `divineShield` | 첫 피해 방어, 파괴 효과는 방어하지 않음 |
| `windfury` | 턴당 공격 2회 |
| `stealth` | 적의 직접 공격/대상 효과 제한; 광역 피해 가능, 공격 시 해제 |
| `poisonous` | 전투로 실제 피해를 준 하수인 처치 |

## 주요 효과 종류

| `kind` | 인자 및 동작 |
|---|---|
| `damage`, `heal` | `target`, `amount` |
| `missiles` | `target`: `randomEnemy`, `randomEnemyMinion`, `randomOtherCharacter`; `count`, `amount` (각 피해 직후 처리하며 주문 공격력은 횟수 증가) |
| `buff` | `target`, `attack`, `health` (영구 증가) |
| `temporaryAttack` | `target`, `amount` (현재 턴 종료까지) |
| `setStats` | `target`, `attack` 및/또는 `health` (수치 지정) |
| `destroy`, `freeze`, `silence`, `bounce` | `target` |
| `transform` | `target`, `cardId` (하수인 변신) |
| `giveKeyword` | `target`, `keyword` |
| `control`, `temporaryControl` | `target:"chosen"`과 적 하수인 대상 규칙, 또는 `target:"randomEnemyMinion"`; 전장 여유 필요. 임시 조종은 즉시 공격 가능, 턴 종료 후 이전 조종자에게 복귀 |
| `draw`, `gainMana`, `gainCrystal`, `armor`, `heroAttack`, `overload`, `discard` | `amount`; 자기 플레이어에게 적용 |
| `summon`, `addCard` | `cardId`, `count`; 전장/손패 제한 적용 |
| `summonUniqueRandom` | `cardIds` 배열; 전장에 없는 카드 중 하나 |
| `equip` | `attack`, `durability` |
| `destroyWeapon` | `side:"enemy"` 또는 `"friendly"` |
| `buffWeapon` | `attack`, `durability`; 내 장착 무기 강화. 조건 없는 주문은 무기 필요 |
| `copyEnemyCard` | `zone:"deck"` 또는 `"hand"`, `count`; 원본 제거 없이 새 인스턴스 생성 |
| `cancelEvent` | 비밀의 이벤트 취소 |

`gainMana`는 현재 마나, `gainCrystal`은 빈 마나 수정, `overload`는 다음 턴 마나 잠금. `discard`와 무작위 대상/카드 복사는 게임 서버 난수로 처리한다.

## 효과 대상

`targetRule`은 효과를 사용할 때 이용할 수 있는 직접 대상의 범위를 제한한다.

- `anyCharacter`, `enemyCharacter`, `friendlyCharacter`
- `anyMinion`, `enemyMinion`, `friendlyMinion`
- `damagedMinion`, `enemyDamagedMinion`, `undamagedMinion`
- `lowAttackEnemyMinion`(공격력 3 이하), `highAttackEnemyMinion`(5 이상). 현재 수치를 기준으로 판단.

`target` 선택자는 `chosen`, `self`, `friendlyHero`, `enemyHero`, `friendlyMinions`, `enemyMinions`, `allMinions`, `allCharacters`, `randomEnemy`, `randomFriendlyMinion`, `randomEnemyMinion`, `eventTarget`, `eventAttacker`, `adjacent`. 특정 종족만 적용하려면 하수인 대상 효과에 `tribe`를 추가한다. `self`와 `adjacent`는 하수인 효과, 이벤트 대상은 비밀/이벤트에서 사용한다.

## 발동과 조건

- `battlecry`: 직접 카드 사용 시; 그냥 소환된 하수인의 전투의 함성은 발동하지 않는다.
- `deathrattle`: 사망 시. 동시에 죽는 하수인을 전장에서 제거한 다음 발동 큐 처리.
- `startTurn`, `endTurn`: 소유자 턴 시작/종료 시.
- `triggers`: `friendlyMinionSummoned`, `friendlySpellCast`, `friendlyMinionDied`, `anyMinionDied`, `selfDamaged`, `anyMinionHealed`. 선택적 `tribe`, 필수 `effects`.
- `auras`: `target`은 `otherFriendlyMinions`, `adjacentFriendlyMinions`, `allOtherMinions`, 필수 `attack`, `health`. 선택적 `tribe`. 살아 있고 침묵하지 않은 원천에 의해 계속 적용된다.
- 효과 객체의 `condition`은 `{"kind":"friendlyTribe","tribe":"beast","minCount":1}`, `{"kind":"combo"}`, `{"kind":"chosenSurvived"}`(선택한 하수인이 여전히 전장에 살아 있음), `{"kind":"enemyMinionCount","minCount":4}`(적 하수인 수). 현재 플레이 턴에 이미 카드를 사용한 경우 연계 활성화. 하수인 효과에서 종족 조건은 자신을 제외한다.

## 격노와 동적 비용

- `enrageAttack:3`: 피해를 받아 생명력이 최대 생명력보다 낮은 동안 공격력 +3. 회복, 침묵 등으로 조건이 해제되면 원래 수치로 되돌린다.
- `freezeOnCombatDamage:true`: 공격 또는 반격으로 피해를 실제로 준 생존 캐릭터를 빙결한다. 천상의 보호막으로 완전히 방어되면 발동하지 않고, 영웅 방어도에 피해를 주면 발동한다. 침묵 시 효과 제거.
- `costAuras:[{"kind":"spell","side":"friendly","amount":-1}]`: 아군 주문·비밀·동전 비용 -1. `kind`는 `spell`, `minion`, `weapon`, `any`; `side`는 `friendly`, `both`; `amount`는 -10~10(0 제외); 하수인에만 선택적 `tribe`. 침묵/사망으로 해제, 중첩 가능, 최종 비용 최소 0.
- `discountByWeaponAttack:true`: 이 하수인 카드 비용이 내 무기 공격력만큼 감소. 현재 비용을 화면과 서버가 똑같이 계산한다.

무기 효과 예시:

```json
{"beforeAttack":[{"kind":"heal","target":"friendlyHero","amount":2}]}
```

빈 전장/대상 제약과 별도로 `temporaryControl`은 이전 조종자를 기록한다. 턴 종료 후 또는 침묵 시 전장에 자리가 있으면 즉시 돌아가며 가득 차 있으면 사망 처리된다. v0.21.0부터 전장 하수인은 현재 조종자의 손패로 반환하고, 변신하면 임시 조종이 제거되어 현재 쪽에 남는다. 변신체는 같은 위치에서 새로운 소환 대기 상태를 갖고 돌진만 즉시 공격할 수 있다. 죽음의 메아리는 사망 당시 조종자 효과로 실행한다.

선택 효과 예시:

```json
{"choices":[{"label":"피해 3","targetRule":"enemyCharacter","effects":[{"kind":"damage","target":"chosen","amount":3}]},{"label":"카드 뽑기","effects":[{"kind":"draw","amount":1}]}]}
```

실제 주문/하수인을 내는 행동에는 선택지 인덱스가 포함되고 서버에서 검증된다.

## 처리 규칙과 한계

하나의 광역 피해 효과는 모든 대상에 피해를 준 후 사망을 처리한다. 사망 시 살아 있는 지속 효과를 재계산하고, 사망 하수인을 함께 제거한 뒤 소환 순서대로 죽음의 메아리/이벤트를 처리한다. 배치 위치와 발동 순서는 구별된다. 피해 반응은 사망 시점 전에 적용되어 치명적 피해에도 발동할 수 있다. 연쇄 발동은 256 작업 한도를 넘으면 행동을 거부하여 무한 루프를 방지한다. 영웅 동시 사망은 무승부 처리. 주문 공격력은 주문의 피해 효과에 적용되며 영웅 능력에는 적용되지 않는다. 비밀은 주문으로 사용되며 상대 비밀에 의해 무효화될 수 있다. `friendlySpellPlayed`는 무효화 전에도 발동하고 `friendlySpellCast`는 실제 주문 해결 후에만 발동한다.

이 독립 게임은 현재 카드 정의에서 필요한 위 효과를 구현한다. 원작의 모든 판정 예외 및 복잡한 다중 이벤트의 세부 순서는 추가 테스트가 필요하다. v0.18.0의 308종 대응 데이터가 원작의 모든 판정까지 일치한다고 주장하지 않는다.

## v0.11.0 추가 효과

| JSON 예시 | 의미 |
|---|---|
| `{"kind":"damageDistinct","count":2,"amount":2}` | 서로 다른 적 하수인 두 명에게 피해 2. 무조건 발동 주문은 필요한 수만큼 적이 있어야 사용 가능. |
| `{"kind":"damageSplash","target":"chosen","amount":4,"splash":1,"scope":"enemyCharacters"}` | 선택한 적 캐릭터에게 피해 4, 나머지 적 캐릭터에게 피해 1. targetRule은 enemyCharacter. |
| `{"kind":"multiplyHealth","target":"chosen","factor":2}` | 현재 생명력의 배수만큼 강화하며 최대 생명력도 함께 증가. 치유 이벤트가 아님. |
| `{"kind":"healFull","target":"chosen"}` | 최대 생명력까지 치유. |
| `{"kind":"deferredDestroy","target":"chosen"}` | 시전자의 다음 턴 시작에 하수인 사망. 침묵과 변신으로 제거. |
| `{"kind":"summonRandom","cardIds":["companion_boar","companion_bear"]}` | 지정한 소환물 중 하나 선택. 이미 전장에 있는 소환물도 다시 소환 가능. |
| `{"kind":"gainCrystal","amount":1,"overflowCardId":"overflow_bloom"}` | 최대 마나 증가; 이미 10이라면 별도 카드 획득. |
| `{"kind":"damage","target":"chosen","amount":3,"bonusIfTribe":{"tribe":"beast","amount":2}}` | 해당 아군 종족이 존재할 때 추가 피해. 주문 공격력은 한 번만 더함. |
| `{"kind":"chooseTopDeck","count":3}` | 자신의 덱 위 최대 세 장 중 하나를 선택해 손에 넣고 나머지 버림. 단독·무조건·대상 없는 주문 효과에 한정. |

- 추가 대상 제한: `lowAttackMinion`(공격력 3 이하), `highAttackMinion`(5 이상), `friendlyBeastMinion`(아군 야수), `demonMinion`(악마).
- 추가 선택자: `friendlyCharacters`, `enemyCharacters`, `otherCharacters`(효과 출처 제외).
- 추가 조건: `{"kind":"eventTargetAttackAtMost","amount":3}`, `{"kind":"chosenDied"}`.
- 하수인 지속 효과 `"chargeAuraTribe":"beast"`: 자신의 야수에게 돌진을 부여하며 출처가 침묵/사망하면 해제. 이미 사용한 공격 횟수는 복구하지 않는다.
- `temporaryAttack`은 아군 영웅과 하수인에게 사용할 수 있고 턴 종료 시 만료된다.
- 비공개 덱 선택은 서버가 후보 ID와 소유자를 관리하며, 선택 완료 전에 다른 행동을 허용하지 않는다. 상대에게는 선택 중이라는 상태만 공개한다.

## v0.12~v0.18 확장 효과

| JSON 예시 | 의미 |
|---|---|
| `{"kind":"buff","target":"self","attack":1,"health":1,"per":"otherFriendlyMinions"}` | 다른 아군 하수인 수에 비례해 능력치 증가 |
| `{"kind":"damage","target":"chosen","amount":2,"bonusIfCombo":2}` | 연계 상태에서 피해 +2 |
| `{"kind":"damage","target":"enemyMinions","amount":2,"amountMax":3}` | 각 적에게 2~3 무작위 피해 |
| `{"kind":"bounce","target":"chosen","discount":2}` | 현재 조종자의 손으로 반환하고 비용 2 감소. 손패 포화 시 사망 |
| `{"kind":"temporaryStealth","target":"friendlyMinions"}` | 다음 아군 턴까지 은신; 공격 또는 피해를 주는 하수인 능력으로 해제 |
| `{"kind":"damageFromHeroAttack","target":"chosen"}` | 현재 영웅 공격력 (무기 포함)만큼 피해 |
| `{"kind":"weaponBurst"}` | 무기를 파괴하고 무기 공격력만큼 적 캐릭터 피해 |
| `{"kind":"grantDeathrattleSummon","target":"friendlyMinions","cardId":"tree_spirit"}` | 각 하수인에 죽음의 메아리 소환 부여 |
| `{"kind":"draw","amount":1,"per":"damagedFriendlyCharacters"}` | 피해 입은 아군 캐릭터 수만큼 드로우 |
| `{"kind":"draw","amount":2,"side":"both"}` | 양쪽 2장씩, 동시 탈진 사망 가능 |
| `{"kind":"drawTribe","tribe":"beast","count":1}` | 덱에서 해당 종족의 카드 무작위 선택 |
| `{"kind":"loseCrystal","amount":1}` | 마나 수정 1개 감소 |
| `{"kind":"consumeAdjacent"}` | 양옆 하수인 파괴, 능력치 흡수 |
| `{"kind":"sacrificeBlast","target":"chosen"}` | 아군 하수인 희생, 공격력만큼 적 하수인 전체 피해 |
| `{"kind":"swapStats","target":"chosen"}` | 현재 공격력/생명력 교환 |
| `{"kind":"grantSpellDamage","target":"adjacent","amount":1}` | 양옆에 주문 공격력 부여 |
| `{"kind":"damageWeapon","side":"enemy","amount":1}` | 상대 무기 내구도 1 감소 |
| `{"kind":"nextSecretFree"}` | 다음 비밀 한 장 비용 0 |
| `{"kind":"drawCostDamage","target":"chosen"}` | 뽑은 카드 기본 비용만큼 피해 |

지속 효과 필드: `noAttack`, `untargetableBySpells`, `chargeWithWeapon`, `attackEqualsHealth`, `healingToDamage`, `enrageWindfury`, `enrageWeaponAttack`, `costAuras[].firstMinionOnly`, `costAuras[].minimum`. 예: `{"kind":"minion","class":"neutral","cost":2,"noAttack":true}`는 필요한 기본 필드와 함께 정의.

새 이벤트: `friendlySpellPlayed`(카드 사용 시점), `friendlySpellCast`(해결 후), `friendlyOverload`(실제 과부하 잠금), `friendlyOverloadCardPlayed`(과부하 카드 사용 시 한 번, 주문이 취소돼도 발동; v0.21.0부터 해방된 원소에 사용), `anyCharacterHealed`, `anyMinionSummoned`, `friendlyCardPlayed`, `anySecretPlayed`. 하수인이 사망 또는 침묵 상태가 되면 더는 지속 효과가 발동하지 않는다.

비밀 발동 조건 10종:

- `enemyAttackHero`: 적이 내 영웅 공격
- `enemyAttackAny`: 적이 공격을 선언
- `enemyMinionAttack`: 적 하수인이 공격을 선언
- `enemyPlayMinion`: 적이 하수인을 냄
- `enemyCastSpell`: 적이 주문을 사용
- `friendlyMinionDied`: 상대 턴에 아군 하수인 사망
- `friendlyHeroDamaged`: 상대 턴에 내 영웅이 피해를 받음
- `enemyAttackFriendlyMinion`: 적 영웅 또는 하수인이 아군 하수인을 공격
- `enemyTargetMinionSpell`: 적이 하수인을 대상으로 주문 사용
- `friendlyHeroLethal`: 상대 턴에 내 영웅이 방어도를 포함한 치명적 피해를 받기 직전

비밀은 상대에게 이름/ID를 제공하지 않는다. `needsBoardSpace`, `needsMinionAttacker`로 발동 가능한 조건을 제한하며 `redirectAttackRandom`, `redirectAttackSummon`, `copyEventMinion`, `reviveEventMinion`, `reflectDamage`, `cancelEvent` 등 공통 효과를 사용한다.

밸런스 편집기의 간편 수치 편집에 현재 효과의 숫자 필드가 나타난다. 숫자를 바꾼 뒤 설명도 직접 수정한다. 저장 전 검사에서는 서버가 데이터와 모든 직업의 30장 덱 구성 가능 여부를 확인하지만 어떤 수치가 공정한지는 자동으로 판단하지 않는다.

v0.19.0 추가: `otherMinions`는 양쪽 전장에서 효과 출처 하수인만 제외한다. 종족 필터와 함께 쓰면 상대 종족도 영향받는다. 무기 `secretRevealedSide:"both"`는 양쪽의 비밀 발동에 반응한다. 지정하지 않으면 이전 카드 데이터와 같이 아군 비밀만 반응한다. 비밀 설치 또는 비밀 제거는 공개 발동과 다르다. 89턴이 끝날 때까지 승패가 나지 않으면 무승부 처리한다.

## v0.22.0 영웅 카드용 공통 효과

| JSON 효과 | 처리 |
|---|---|
| `{"kind":"brawl"}` | 양쪽 하수인이 2개 이상 있을 때 무작위 한 하수인을 제외하고 모두 파괴 |
| `{"kind":"damageFromArmor","target":"chosen"}` | 내 방어도와 주문 공격력만큼 피해 |
| `{"kind":"drawDiscounted","amount":3}` | 덱 위 카드 1장 뽑고 실제 손에 들어온 인스턴스에 할인 |
| `{"kind":"discountNextSpell","amount":3}` | 이번 턴의 다음 주문/비밀/동전 할인; 사용·턴 종료 시 소멸 |
| `{"kind":"immuneThisTurn","target":"chosen"}` | 해당 하수인 피해 및 상대 지정 면역 (턴 종료/침묵으로 해제) |
| `{"kind":"heroImmuneThisTurn"}` | 치명적 피해 전 비밀이 발동해 영웅 피해 차단; 턴 종료 시 해제 |
| `{"kind":"consumeDivineShields"}` | 양쪽 보호막 제거, 효과 출처 하수인 하나당 +3/+3 |
| `{"kind":"copyChosenMinion","target":"chosen"}` | 선택한 하수인의 카드 ID와 상태를 복사하되 새로운 인스턴스와 조종권 유지 |
| `{"kind":"shadowform"}` | 피해 2 영웅 능력 → 피해 3 능력, 변경 시 능력 사용 횟수 초기화 |
| `{"kind":"summonEnemyDeckMinion","fallbackCardId":"shadow_of_nothing"}` | 상대 덱의 무작위 하수인 복사 소환. 없으면 지정된 토큰 소환 |

하수인 `discountBy`는 `boardCount`, `otherHandCards`, `missingHeroHealth` 중 하나로 지정한다. 이 경우 기본 비용을 0~30으로 설정할 수 있으나 실제 마나 수정 제한은 10이다. 손패의 다른 카드 수, 양쪽 전장의 하수인 수, 현재 체력은 서버/클라이언트가 동일 규칙으로 계산한다. 신규 대상 규칙 `attackAtLeast7Minion`, `enemyAttackAtMost2Minion`, `murlocMinion`은 현재 수치/종족으로 판정한다.

무기의 선택 필드 `windfury:true`, `attackLossVsMinion:true`, `immuneWhileAttacking:true`, `friendlySummon`은 각각 영웅 공격 2회, 하수인 공격 시 공격력 소모, 전투 중 피해 방지, 아군 하수인 소환 후 효과를 의미한다. 무기가 교체·파괴되면 새 무기 기준으로 남은 공격 횟수를 재산정한다. 상대에게는 손패 인스턴스 할인 및 덱 내용이 노출되지 않는다.
