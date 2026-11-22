# 오리지널 카드 구현 기준 및 후속 작업

## 기준 시점 (제안)

2014년에는 오리지널 카드의 능력치와 비용도 여러 차례 변경되었다. 하나의 일관된 규칙 집합을 위해 **2014년 6월 패치 1.0.0.5832**를 기본 비교 기준으로 제안한다. 블리자드가 2021년 클래식 모드를 발표하면서 이 패치를 복원 기준으로 명시했다.

- 출처: [Blizzard, Introducing the Core Set and Classic Format (2021-02-09)](https://hearthstone.blizzard.com/en-us/news/23620129)
- v0.37.0부터 당시 기본·일반·희귀·영웅·전설 등급을 모두 포함한다. 이후 확장팩 및 이후에 추가된 클래식 카드는 제외한다. 2014년 보상·프로모션 카드도 포함한다.
- 소환물·동전 등은 덱 구성용 카드가 아닌 별도의 시스템 정의로 관리한다.
- 원작의 코드, 이미지, 음원과 카드 설명 원문을 추출하지 않는다. 개별 게임 규칙과 수치의 참고 기준을 기록하되 독립적인 이름·설명·구현으로 관리한다.
- v0.23.0의 활성 데이터는 382종의 기본·일반·희귀·영웅·전설 대응 카드다. 아래 표와 `data/rosters/legendary-2014.json` 및 `apps/client/src/reference-art-data.ts`는 식별명과 프로젝트 ID를 연결한다. `Classic` 카드 세트와 2021년 `Classic` 모드는 의미가 다르므로 총 카드 수만 보고 목록을 가져오지 않는다.

## 첫 검증 묶음: 마법사 기본 10종 (v0.8.0)

비교용 커뮤니티 자료: [Basic](https://hearthstone.wiki.gg/wiki/Basic), [Mage/Classic format](https://hearthstone.wiki.gg/wiki/Mage/Classic_format), [2014년 기본 카드 목록](https://liquipedia.net/hearthstone/List_of_Basic_Cards), [2014년 8월 기본 덱](https://linuxtest.hearthpwn.com/decks/91680-basic-mage), [Classic Water Elemental](https://hearthstone.wiki.gg/wiki/Water_Elemental_(Classic)), [Classic Flamestrike](https://hearthstone.wiki.gg/wiki/Flamestrike_(Classic)). 공식 기준 패치는 앞의 블리자드 공지를 우선한다. 원작 이름은 내부 대응표에 식별용으로만 기록했다. 카드 설명과 아트는 복제하지 않고 독립 구현을 사용한다.

| 원작 기준 식별명 | 프로젝트 카드 ID | 비용 | 검증한 기계적 규칙 |
|---|---|---:|---|
| Arcane Missiles | `starlight_barrage` | 1 | 적 무작위 피해 1 × 3; 주문 공격력은 횟수 증가 |
| Mirror Image | `mirage_patrol` | 1 | 0/2 도발 토큰 2기, 전장 제한 |
| Arcane Explosion | `mana_burst` | 2 | 모든 적 하수인 피해 1 |
| Frostbolt | `ice_shard` | 2 | 캐릭터 하나 피해 3 및 빙결 |
| Arcane Intellect | `arcane_notes` | 3 | 카드 2장 드로우 |
| Frost Nova | `winter_field` | 3 | 적 전장의 모든 하수인 빙결 |
| Fireball | `flame_sphere` | 4 | 캐릭터 하나 피해 6 |
| Polymorph | `sheep_hex` | 4 | 하수인 1/1 양으로 변신 |
| Water Elemental | `glacial_construct` | 4 | 3/6, 전투 피해를 준 생존 대상 빙결 |
| Flamestrike | `flame_tide` | 7 | 적 하수인들에게 피해 4 |

이 10종 외의 마법사 플레이테스트 카드(예: 별도 마력 탄막)는 계속 개발용 데이터에 포함되어 있다. 이후 최종 오리지널 규칙 기준 전용 카탈로그를 만들 때는 중복/테스트용 카드 ID를 따로 분리한다. 현재 검증은 주요 카드 규칙을 기준으로 하며 2014년도 모든 예외까지 완전히 입증한 것은 아니다. 다음에는 마법사의 일반/희귀 또는 다른 직업 기본 카드 10종을 같은 방법으로 대조한다.

## 두 번째 검증 묶음: 나머지 8개 직업 기본 80종 (v0.11.0)

9개 직업의 기본 카드 90종(마법사 10종 + 이번 80종) 대응 데이터 구현을 완료했다. 일부 기존 카드를 대조하여 갱신했고, 신규 59종을 추가했다. 활성 카탈로그에는 별도의 개발용 카드도 남아 있어 194종 전체가 원작과 1:1 대응하는 것은 아니다.

비교 기준 자료: [2014년 기본 카드 목록](https://liquipedia.net/hearthstone/List_of_Basic_Cards), [Warrior](https://hearthstone.wiki.gg/wiki/Warrior/Classic_format), [Paladin](https://hearthstone.wiki.gg/wiki/Paladin/Classic_format), [Druid](https://hearthstone.wiki.gg/wiki/Druid/Classic_format), [Priest](https://hearthstone.wiki.gg/wiki/Priest/Classic_format), [Rogue](https://hearthstone.wiki.gg/wiki/Rogue/Classic_format), [Shaman](https://hearthstone.wiki.gg/wiki/Shaman/Classic_format), [Warlock](https://hearthstone.wiki.gg/wiki/Warlock/Classic_format), [Hunter](https://hearthstone.wiki.gg/wiki/Hunter/Classic_format). 현대판 비용/텍스트 대신 해당 시기의 규칙을 사용한다. 개별 역사적 판정 참고: [Warsong Commander](https://hearthstone.wiki.gg/wiki/Warsong_Commander), [Charge](https://hearthstone.wiki.gg/wiki/Charge_(card)), [Cleave](https://hearthstone.wiki.gg/wiki/Cleave), [Wild Growth](https://hearthstone.wiki.gg/wiki/Wild_Growth), [Divine Spirit](https://hearthstone.wiki.gg/wiki/Divine_Spirit).

| 직업 | 원작 식별명 | 프로젝트 ID | 비용 | 공격/생명 또는 내구도 | 대응 규칙 |
|---|---|---|---:|---|---|
| 전사 | Execute | `fatal_finish` | 1 | — | 부상당한 적 하수인을 제거합니다. |
| 전사 | Whirlwind | `blade_cyclone` | 1 | — | 양쪽 전장의 하수인 모두에게 피해 1. |
| 전사 | Cleave | `twin_cleave` | 2 | — | 서로 다른 무작위 적 하수인 둘에게 각각 피해 2. 적이 둘 이상 필요합니다. |
| 전사 | Fiery War Axe | `iron_axe` | 2 | 3/2 | — |
| 전사 | Heroic Strike | `champion_strike` | 2 | — | 이번 턴 내 영웅 공격력 +4. |
| 전사 | Charge | `battle_cry` | 3 | — | 아군 하수인 하나에게 공격력 +2 및 돌진을 줍니다. |
| 전사 | Shield Block | `shield_wall` | 3 | — | 방어도 5를 얻고 카드 한 장을 뽑습니다. |
| 전사 | Warsong Commander | `charge_officer` | 3 | 2/3 | 다른 아군 하수인이 소환될 때 공격력이 3 이하이면 돌진을 부여합니다. |
| 전사 | Kor’kron Elite | `vanguard_elite` | 4 | 4/3 | 돌진 |
| 전사 | Arcanite Reaper | `great_waraxe` | 5 | 5/2 | — |
| 성기사 | Blessing of Might | `valor_blessing` | 1 | — | 하수인 하나의 공격력을 3 높입니다. |
| 성기사 | Hand of Protection | `light_guard` | 1 | — | 하수인 하나에게 천상의 보호막을 부여합니다. |
| 성기사 | Humility | `humbling_light` | 1 | — | 하수인 하나의 공격력을 1로 바꿉니다. |
| 성기사 | Light’s Justice | `dawn_mace` | 1 | 1/4 | — |
| 성기사 | Holy Light | `restoring_ray` | 2 | — | 캐릭터 하나의 생명력을 6 회복합니다. |
| 성기사 | Hammer of Wrath | `judgment_hammer` | 4 | — | 캐릭터 하나에게 피해 3을 주고 카드 한 장을 뽑습니다. |
| 성기사 | Blessing of Kings | `sovereign_blessing` | 4 | — | 하수인 하나의 공격력과 생명력을 각각 4 높입니다. |
| 성기사 | Consecration | `hallowed_ground` | 4 | — | 적 영웅과 적 하수인 전부에게 피해 2. |
| 성기사 | Truesilver Champion | `healing_hammer` | 4 | 4/2 | 영웅이 공격하기 직전 생명력 2를 회복합니다. |
| 성기사 | Guardian of Kings | `crown_sentinel` | 7 | 5/6 | 전투의 함성: 내 영웅의 생명력을 6 회복합니다. |
| 드루이드 | Innervate | `wild_growth` | 0 | — | 이번 턴에 마나 2를 얻습니다. |
| 드루이드 | Moonfire | `moon_spark` | 0 | — | 캐릭터 하나에게 피해 1. |
| 드루이드 | Claw | `thorn_claw` | 1 | — | 이번 턴 내 영웅 공격력 +2, 방어도 2 획득. |
| 드루이드 | Mark of the Wild | `wild_mark` | 2 | — | 하수인 하나에게 +2/+2와 도발을 부여합니다. |
| 드루이드 | Wild Growth | `root_bloom` | 2 | — | 빈 마나 수정 1개를 얻습니다. 최대 마나가 10이면 대신 0마나 드로우 카드를 얻습니다. |
| 드루이드 | Healing Touch | `verdant_touch` | 3 | — | 캐릭터 하나의 생명력을 8 회복합니다. |
| 드루이드 | Savage Roar | `forest_roar` | 3 | — | 이번 턴 모든 아군 캐릭터의 공격력 +2. |
| 드루이드 | Swipe | `raking_storm` | 4 | — | 선택한 적에게 피해 4, 나머지 적 캐릭터에게 피해 1. |
| 드루이드 | Starfire | `star_fall` | 6 | — | 캐릭터 하나에게 피해 5. 카드 한 장을 뽑습니다. |
| 드루이드 | Ironbark Protector | `ironwood_guardian` | 8 | 8/8 | 도발 |
| 사제 | Holy Smite | `sacred_spark` | 1 | — | 캐릭터 하나에게 피해 2. |
| 사제 | Mind Vision | `mental_glimpse` | 1 | — | 상대 손패의 무작위 카드 한 장을 복사해 내 손에 넣습니다. |
| 사제 | Northshire Cleric | `healing_scholar` | 1 | 1/3 | 하수인이 실제 생명력을 회복할 때마다 카드 한 장을 뽑습니다. |
| 사제 | Power Word: Shield | `life_barrier` | 1 | — | 하수인 하나의 생명력을 2 높이고 카드 한 장을 뽑습니다. |
| 사제 | Divine Spirit | `spirit_doubling` | 2 | — | 하수인 하나의 현재 생명력을 두 배로 늘립니다. |
| 사제 | Shadow Word: Pain | `weakpoint_sentence` | 2 | — | 공격력이 3 이하인 하수인을 제거합니다. |
| 사제 | Shadow Word: Death | `giant_sentence` | 3 | — | 공격력이 5 이상인 하수인을 제거합니다. |
| 사제 | Mind Blast | `mind_burst` | 2 | — | 상대 영웅에게 피해 5. |
| 사제 | Holy Nova | `radiant_wave` | 5 | — | 적 캐릭터 모두에게 피해 2, 아군 캐릭터 모두의 생명력 2 회복. |
| 사제 | Mind Control | `mind_claim` | 10 | — | 적 하수인 하나를 내 전장으로 가져옵니다. |
| 도적 | Backstab | `precise_stab` | 0 | — | 부상당하지 않은 하수인에게 피해 2. |
| 도적 | Deadly Poison | `weapon_hone` | 1 | — | 장착한 내 무기의 공격력을 2 높입니다. |
| 도적 | Sinister Strike | `night_strike` | 1 | — | 상대 영웅에게 피해 3. |
| 도적 | Sap | `storm_retreat` | 2 | — | 적 하수인을 현재 조종자의 손으로 돌려보냅니다. |
| 도적 | Shiv | `needle_cut` | 2 | — | 캐릭터 하나에게 피해 1. 카드 한 장을 뽑습니다. |
| 도적 | Fan of Knives | `knife_fan` | 3 | — | 적 하수인 모두에게 피해 1. 카드 한 장을 뽑습니다. |
| 도적 | Assassinate | `silent_execution` | 5 | — | 적 하수인 하나를 제거합니다. |
| 도적 | Assassin’s Blade | `shadow_rapier` | 5 | 3/4 | — |
| 도적 | Vanish | `smoke_escape` | 6 | — | 전장에 있는 모든 하수인을 현재 조종자의 손으로 돌려보냅니다. |
| 도적 | Sprint | `rapid_mission` | 7 | — | 카드 네 장을 뽑습니다. |
| 주술사 | Ancestral Healing | `ancestral_renewal` | 0 | — | 하수인 하나의 생명력을 완전히 회복시키고 도발을 부여합니다. |
| 주술사 | Totemic Might | `totem_resilience` | 0 | — | 내 토템 전부의 생명력을 2 높입니다. |
| 주술사 | Frost Shock | `frost_jolt` | 1 | — | 적 캐릭터 하나에게 피해 1 및 빙결. |
| 주술사 | Rockbiter Weapon | `stone_edge` | 1 | — | 이번 턴 아군 캐릭터 하나의 공격력 +3. |
| 주술사 | Flametongue Totem | `ember_totem` | 2 | 0/3 | 양옆 아군 하수인의 공격력 +2. |
| 주술사 | Windfury | `wind_blessing` | 2 | — | 하수인 하나에게 질풍을 부여합니다. |
| 주술사 | Hex | `toad_curse` | 3 | — | 하수인 하나를 0/1 도발 두꺼비로 바꿉니다. |
| 주술사 | Windspeaker | `wind_oracle` | 4 | 3/3 | 전투의 함성: 아군 하수인 하나에게 질풍을 부여합니다. |
| 주술사 | Bloodlust | `blood_ritual` | 5 | — | 이번 턴 내 하수인 모두의 공격력 +3. |
| 주술사 | Fire Elemental | `flame_spirit` | 6 | 6/5 | 전투의 함성: 캐릭터 하나에게 피해 3. |
| 흑마법사 | Sacrificial Pact | `demon_pact` | 0 | — | 악마 하나를 제거하고 내 영웅 생명력을 5 회복합니다. |
| 흑마법사 | Soulfire | `soul_flame` | 0 | — | 캐릭터 하나에게 피해 4. 무작위 손패 한 장을 버립니다. |
| 흑마법사 | Corruption | `decay_mark` | 1 | — | 적 하수인 하나를 지정합니다. 내 다음 턴 시작 시 그 하수인이 죽습니다. |
| 흑마법사 | Mortal Coil | `life_thread` | 1 | — | 하수인 하나에게 피해 1. 죽으면 카드 한 장을 뽑습니다. |
| 흑마법사 | Voidwalker | `void_sentinel` | 1 | 1/3 | 도발 |
| 흑마법사 | Succubus | `tempting_fiend` | 2 | 4/3 | 전투의 함성: 무작위 손패 한 장을 버립니다. |
| 흑마법사 | Drain Life | `life_siphon` | 3 | — | 캐릭터 하나에게 피해 2. 내 영웅 생명력을 2 회복합니다. |
| 흑마법사 | Shadow Bolt | `shadow_lance` | 3 | — | 하수인 하나에게 피해 4. |
| 흑마법사 | Hellfire | `infernal_blast` | 4 | — | 양쪽 영웅과 모든 하수인에게 피해 3. |
| 흑마법사 | Dread Infernal | `abyssal_colossus` | 6 | 6/6 | 전투의 함성: 자신을 제외한 모든 캐릭터에게 피해 1. |
| 사냥꾼 | Hunter’s Mark | `prey_mark` | 0 | — | 하수인 하나의 생명력을 1로 바꿉니다. |
| 사냥꾼 | Arcane Shot | `arcane_arrow` | 1 | — | 캐릭터 하나에게 피해 2. |
| 사냥꾼 | Timber Wolf | `forest_wolf` | 1 | 1/1 | 다른 아군 야수의 공격력 +1. |
| 사냥꾼 | Starving Buzzard | `wild_tracker` | 2 | 2/1 | 다른 아군 야수가 소환될 때마다 카드 한 장을 뽑습니다. |
| 사냥꾼 | Animal Companion | `companion_call` | 3 | — | 세 종류의 야수 동료 중 하나를 무작위로 소환합니다. |
| 사냥꾼 | Kill Command | `wild_arrow` | 3 | — | 캐릭터 하나에게 피해 3. 아군 야수가 있으면 피해 5. |
| 사냥꾼 | Multi-Shot | `double_volley` | 4 | — | 서로 다른 무작위 적 하수인 둘에게 각각 피해 3. 적이 둘 이상 필요합니다. |
| 사냥꾼 | Houndmaster | `beast_tamer` | 4 | 4/3 | 전투의 함성: 아군 야수 하나에게 +2/+2와 도발을 부여합니다. |
| 사냥꾼 | Tundra Rhino | `tundra_beast` | 5 | 2/5 | 내 야수 모두에게 돌진을 부여하는 지속 효과. |
| 사냥꾼 | Tracking | `tracking_trail` | 1 | — | 덱 위 3장 중 하나 선택, 나머지 폐기. |

카드별 모든 2014 판정 예외가 입증된 것은 아니다. 다음은 공용 기본 카드에 대해 동일한 대응표를 작성하고, 이후 직업별 일반/희귀 카드의 당시 등급·비용·규칙을 대조한다. 최종 원작 대응 카탈로그와 독자 개발용 카드 분리는 후속 단계다.

## 아직 필요한 효과 검토

| 규칙 | 현재 상태 | 후속 검증 |
|---|---|---|
| 기본 피해, 치유, 드로우, 강화, 다수 대상, 소환 | 구현 | 카드별 값 및 경계 사례 |
| 전투의 함성, 죽음의 메아리, 연계, 선택, 과부하 | 구현 | 특수 발동 순서 |
| 도발, 돌진, 질풍, 은신, 천상의 보호막, 독성 | 구현 | 복합 상호작용 |
| 종족 시너지, 지속 강화, 소환/피해/치유 이벤트 | 구현 | 추가 발동 조건 |
| 격노, 공격력/부상 기반 대상 제한, 비용 수정 | 주요 효과 구현 | 카드별 세부 할인 조건, 턴 만료 |
| 연쇄 무작위 피해, 치유의 피해 반전 | 연쇄 무작위 피해 구현, 치유 반전 부족 | 대상 사망, 주문 공격력 적용 및 추가 효과 |
| 무기 자체 효과, 무기 강화, 추가 비밀 조건 | 무기 장착/공격 전/비밀 발동 구현, 추가 비밀 조건 부족 | 공격 전후 발동, 내구도, 비밀 공개 순서 |
| 임시 조종, 소유자 복귀, 효과 대상 변경 | 임시 조종과 소유자 복귀 구현; 대상 변경 부족 | 전장 포화, 사망·손패 반환 |

## 카드 추가 절차

1. 해당 카드의 기준 시점, 등급, 직업, 비용, 수치와 적용 규칙을 확인한다.
2. 기존 공통 효과로 표현 가능한지 확인한다. 불가능하면 카드 이름에 의존하지 않는 일반 효과부터 추가한다.
3. 선택 가능 대상, 비용, 처리 순서, 비공개 정보, 효과 취소 조건을 자동 테스트한다.
4. 새로운 버전 JSON을 만들고 기존 버전을 유지한다. `active.json`만 새 버전을 가리키도록 변경한다.
5. 모든 직업의 유효한 30장 덱과 실제 두 클라이언트 대전, 관리자 편집기 호환성을 회귀 테스트한다.

구현 여부는 카드별로 검증한 후 기록한다. 카드 수만 늘어나거나 설명만 추가된 것을 완료로 간주하지 않는다.

## 세 번째 묶음: 공용 기본 43종 (v0.12.0)

참고: [2014년 기본 카드 목록](https://liquipedia.net/hearthstone/List_of_Basic_Cards), [공용 기본 카드](https://outof.games/realms/hearthstone/guides/32-how-to-unlock-all-the-golden-neutral-basic-cards/), [개별 클래식 카드](https://hearthstone.wiki.gg/wiki/Classic_(2014-2021)). 9개 직업 기본 90종과 합해 133종.

| 직업 | 원작 식별명 | 프로젝트 ID | 희귀도 | 비용 | 수치 | 대응 효과 |
|---|---|---|---|---:|---|---|
| 공용 | Elven Archer | `archer` | 기본 | 1 | 1/1 | 전투의 함성: 캐릭터 하나에게 피해 1. |
| 공용 | Goldshire Footman | `recruit` | 기본 | 1 | 1/2 | 도발 |
| 공용 | Grimscale Oracle | `reef_oracle` | 기본 | 1 | 1/1 | 자신 외 모든 멀록의 공격력 +1. |
| 공용 | Murloc Raider | `reef_scout` | 기본 | 1 | 2/1 | — |
| 공용 | Stonetusk Boar | `wild_boar` | 기본 | 1 | 1/1 | 돌진 |
| 공용 | Voodoo Doctor | `herb_doctor` | 기본 | 1 | 2/1 | 전투의 함성: 캐릭터 하나의 생명력 2 회복. |
| 공용 | Acidic Swamp Ooze | `rust_collector` | 기본 | 2 | 3/2 | 전투의 함성: 상대 무기를 파괴합니다. |
| 공용 | Bloodfen Raptor | `wolf` | 기본 | 2 | 3/2 | — |
| 공용 | Bluegill Warrior | `reef_charger` | 기본 | 2 | 2/1 | 돌진 |
| 공용 | Frostwolf Grunt | `frost_guard` | 기본 | 2 | 2/2 | 도발 |
| 공용 | Kobold Geomancer | `earth_mage` | 기본 | 2 | 2/2 | 주문 공격력 +1. |
| 공용 | Murloc Tidehunter | `reef_guard` | 기본 | 2 | 2/1 | 전투의 함성: 1/1 멀록 토큰 소환. |
| 공용 | Novice Engineer | `junior_inventor` | 기본 | 2 | 1/1 | 전투의 함성: 카드 한 장을 뽑습니다. |
| 공용 | River Crocolisk | `river_lizard` | 기본 | 2 | 2/3 | — |
| 공용 | Dalaran Mage | `tower_mage` | 기본 | 3 | 1/4 | 주문 공격력 +1. |
| 공용 | Ironforge Rifleman | `mountain_rifleman` | 기본 | 3 | 2/2 | 전투의 함성: 캐릭터 하나에게 피해 1. |
| 공용 | Ironfur Grizzly | `iron_bear` | 기본 | 3 | 3/3 | 도발 |
| 공용 | Magma Rager | `lava_rager` | 기본 | 3 | 5/1 | — |
| 공용 | Raid Leader | `war_banner` | 기본 | 3 | 2/2 | 다른 아군 하수인의 공격력 +1. |
| 공용 | Razorfen Hunter | `boar_trapper` | 기본 | 3 | 2/3 | 전투의 함성: 1/1 야수 토큰 소환. |
| 공용 | Shattered Sun Cleric | `dawn_cleric` | 기본 | 3 | 3/2 | 전투의 함성: 다른 아군 하수인 하나에게 +1/+1. |
| 공용 | Silverback Patriarch | `silver_gorilla` | 기본 | 3 | 1/4 | 도발 |
| 공용 | Wolfrider | `swift_horse` | 기본 | 3 | 3/1 | 돌진 |
| 공용 | Chillwind Yeti | `snow_brute` | 기본 | 4 | 4/5 | — |
| 공용 | Dragonling Mechanic | `clockwork_smith` | 기본 | 4 | 2/4 | 전투의 함성: 2/1 장치 토큰 소환. |
| 공용 | Gnomish Inventor | `senior_inventor` | 기본 | 4 | 2/4 | 전투의 함성: 카드 한 장을 뽑습니다. |
| 공용 | Oasis Snapjaw | `oasis_turtle` | 기본 | 4 | 2/7 | — |
| 공용 | Ogre Magi | `cave_mage` | 기본 | 4 | 4/4 | 주문 공격력 +1. |
| 공용 | Sen'jin Shieldmasta | `citadel_guard` | 기본 | 4 | 3/5 | 도발 |
| 공용 | Stormwind Knight | `citadel_knight` | 기본 | 4 | 2/5 | 돌진 |
| 공용 | Booty Bay Bodyguard | `port_guard` | 기본 | 5 | 5/4 | 도발 |
| 공용 | Darkscale Healer | `moon_healer` | 기본 | 5 | 4/5 | 전투의 함성: 아군 캐릭터 모두 생명력 2 회복. |
| 공용 | Frostwolf Warlord | `frost_commander` | 기본 | 5 | 4/4 | 전투의 함성: 다른 아군 하수인 수만큼 +1/+1. |
| 공용 | Gurubashi Berserker | `arena_berserker` | 기본 | 5 | 2/7 | 피해를 입고 살아남으면 공격력 +3. |
| 공용 | Nightblade | `shadow_blade` | 기본 | 5 | 4/4 | 전투의 함성: 상대 영웅에게 피해 3. |
| 공용 | Stormpike Commando | `peak_commando` | 기본 | 5 | 4/2 | 전투의 함성: 캐릭터 하나에게 피해 2. |
| 공용 | Archmage | `high_mage` | 기본 | 6 | 4/7 | 주문 공격력 +1. |
| 공용 | Boulderfist Ogre | `ogre` | 기본 | 6 | 6/7 | — |
| 공용 | Lord of the Arena | `arena_master` | 기본 | 6 | 6/5 | 도발 |
| 공용 | Reckless Rocketeer | `rocket_raider` | 기본 | 6 | 5/2 | 돌진 |
| 공용 | Core Hound | `core_hound` | 기본 | 7 | 9/5 | — |
| 공용 | Stormwind Champion | `citadel_champion` | 기본 | 7 | 6/6 | 다른 아군 하수인에게 +1/+1. |
| 공용 | War Golem | `war_construct` | 기본 | 7 | 7/7 | — |

## 네 번째 묶음: 직업 일반·희귀 99종 (v0.13~0.15)

직업별 기본 10종 + 일반/희귀 11종 = 21종. 참고: [원본 세트 체크리스트](https://cardhuntershq.com/browse/hearthstone/VANILLA/checklist), 각 직업의 Classic format 목록, 공식 복원 기준 패치. 희귀도와 수치는 2014년 판정을 참고한 독립 설계 값이다.

| 직업 | 원작 식별명 | 프로젝트 ID | 희귀도 | 비용 | 수치 | 대응 효과 |
|---|---|---|---|---:|---|---|
| 전사 | Inner Rage | `inner_wrath` | 일반 | 0 | — | 하수인 하나에게 피해 1을 주고 공격력을 2 높입니다. |
| 전사 | Rampage | `battle_frenzy` | 일반 | 2 | — | 부상당한 하수인 하나에게 +3/+3. |
| 전사 | Battle Rage | `battle_rage` | 일반 | 2 | — | 부상당한 아군 캐릭터 수만큼 카드를 뽑습니다. |
| 전사 | Slam | `test_of_steel` | 일반 | 2 | — | 하수인 하나에게 피해 2. 살아남으면 카드 한 장을 뽑습니다. |
| 전사 | Cruel Taskmaster | `harsh_overseer` | 일반 | 2 | 2/2 | 전투의 함성: 하수인 하나에게 피해 1, 공격력 +2. |
| 전사 | Arathi Weaponsmith | `war_smith` | 일반 | 4 | 3/3 | 전투의 함성: 2/2 무기를 장착합니다. |
| 전사 | Armorsmith | `blood_veteran` | 희귀 | 2 | 1/4 | 아군 하수인이 피해를 받을 때마다 방어도 1 획득. |
| 전사 | Frothing Berserker | `frenzy_fighter` | 희귀 | 3 | 2/4 | 하수인이 피해를 받을 때마다 공격력 +1. |
| 전사 | Mortal Strike | `mortal_blow` | 희귀 | 4 | — | 캐릭터 하나에게 피해 4. 내 영웅 생명력이 12 이하이면 피해 6. |
| 전사 | Upgrade! | `weapon_upgrade` | 희귀 | 1 | — | 무기에 +1/+1. 무기가 없으면 1/3 무기를 장착. |
| 전사 | Commanding Shout | `final_stand` | 희귀 | 2 | — | 이번 턴 아군 하수인은 피해로 생명력 1 미만이 되지 않습니다. 카드 한 장을 뽑습니다. |
| 드루이드 | Naturalize | `return_to_earth` | 일반 | 1 | — | 하수인 하나를 제거하고 상대에게 카드 두 장을 뽑게 합니다. |
| 드루이드 | Wrath | `nature_choice` | 일반 | 2 | — | 선택: 하수인에게 피해 3 / 피해 1 및 카드 한 장 뽑기. |
| 드루이드 | Power of the Wild | `forest_blessing` | 일반 | 2 | — | 선택: 아군 하수인 모두 +1/+1 / 3/2 야수 소환. |
| 드루이드 | Mark of Nature | `grove_choice` | 일반 | 3 | — | 선택: 하수인 공격력 +4 / 생명력 +4 및 도발. |
| 드루이드 | Soul of the Forest | `forest_soul` | 일반 | 4 | — | 아군 하수인 전부에게 죽음의 메아리: 2/2 나무 정령 소환. |
| 드루이드 | Druid of the Claw | `shape_guardian` | 일반 | 5 | 4/4 | 선택: 4/4 돌진 형태 / 4/6 도발 형태. |
| 드루이드 | Savagery | `wild_surge` | 희귀 | 1 | — | 하수인 하나에게 내 영웅 공격력만큼 피해. |
| 드루이드 | Bite | `fanged_bite` | 희귀 | 4 | — | 이번 턴 내 영웅 공격력 +4, 방어도 4 획득. |
| 드루이드 | Keeper of the Grove | `ancient_warden` | 희귀 | 4 | 2/4 | 선택: 캐릭터 하나에게 피해 2 / 하수인 하나 침묵. |
| 드루이드 | Nourish | `fertile_land` | 희귀 | 5 | — | 선택: 채워진 마나 수정 2개 / 카드 3장 뽑기. |
| 드루이드 | Starfall | `nature_wave` | 희귀 | 5 | — | 선택: 하수인 하나에게 피해 5 / 모든 적 하수인에게 피해 2. |
| 도적 | Shadowstep | `shadow_step` | 일반 | 0 | — | 아군 하수인 하나를 손패로 돌리고 비용을 2 낮춥니다. |
| 도적 | Cold Blood | `cold_blade` | 일반 | 1 | — | 하수인 공격력 +2. 연계: 추가로 +2. |
| 도적 | Conceal | `smoke_veil` | 일반 | 1 | — | 다음 내 턴 시작까지 아군 하수인 전부 은신. |
| 도적 | Betrayal | `treachery` | 일반 | 2 | — | 적 하수인 하나가 양옆 하수인에게 공격력만큼 피해를 줍니다. |
| 도적 | Defias Ringleader | `bandit_leader` | 일반 | 2 | 2/2 | 연계: 2/1 도적 토큰 소환. |
| 도적 | Eviscerate | `twin_strike` | 일반 | 2 | — | 캐릭터 하나에게 피해 2. 연계: 피해 4. |
| 도적 | Blade Flurry | `blade_burst` | 희귀 | 2 | — | 내 무기를 파괴하고 그 공격력만큼 모든 적 캐릭터에 피해. |
| 도적 | Headcrack | `skull_strike` | 희귀 | 3 | — | 적 영웅에게 피해 2. 연계: 다음 내 턴 시작에 이 카드가 손으로 돌아옵니다. |
| 도적 | Perdition's Blade | `ambush_dagger` | 희귀 | 3 | 2/2 | 전투의 함성: 캐릭터 하나에게 피해 1. 연계: 피해 2. |
| 도적 | SI:7 Agent | `shadow_duelist` | 희귀 | 3 | 3/3 | 연계: 캐릭터 하나에게 피해 2. |
| 도적 | Master of Disguise | `masked_agent` | 희귀 | 4 | 4/4 | 전투의 함성: 아군 하수인 하나에게 은신 부여. |
| 주술사 | Lightning Bolt | `lightning_debt` | 일반 | 1 | — | 캐릭터 하나에게 피해 3. 과부하 (1). |
| 주술사 | Dust Devil | `dust_wraith` | 일반 | 1 | 3/1 | 질풍. 과부하 (2). |
| 주술사 | Earth Shock | `earth_shock` | 일반 | 1 | — | 하수인 하나를 침묵시킨 뒤 피해 1. |
| 주술사 | Stormforged Axe | `storm_mace` | 일반 | 2 | 2/3 | 과부하 (1). |
| 주술사 | Forked Lightning | `forked_bolt` | 일반 | 1 | — | 서로 다른 무작위 적 하수인 둘에게 피해 2. 과부하 (2). |
| 주술사 | Unbound Elemental | `storm_elemental` | 일반 | 3 | 2/4 | 과부하 카드 사용 때마다 +1/+1. |
| 주술사 | Lava Burst | `lava_burst` | 희귀 | 3 | — | 캐릭터 하나에게 피해 5. 과부하 (2). |
| 주술사 | Feral Spirit | `spirit_pack` | 희귀 | 3 | — | 2/3 도발 늑대 둘 소환. 과부하 (2). |
| 주술사 | Lightning Storm | `thunderstorm` | 희귀 | 3 | — | 적 하수인 각각에게 무작위 피해 2~3. 과부하 (2). |
| 주술사 | Mana Tide Totem | `mana_tide` | 희귀 | 3 | 0/3 | 내 턴 종료마다 카드 한 장 뽑기. |
| 주술사 | Ancestral Spirit | `ancestor_spirit` | 희귀 | 2 | — | 하수인 하나에게 죽음의 메아리: 같은 하수인 다시 소환. |
| 흑마법사 | Flame Imp | `imp_scout` | 일반 | 1 | 3/2 | 전투의 함성: 내 영웅에게 피해 3. |
| 흑마법사 | Blood Imp | `blood_imp` | 일반 | 1 | 0/1 | 은신. 내 턴 종료마다 다른 무작위 아군 하수인 생명력 +1. |
| 흑마법사 | Power Overwhelming | `overpower` | 일반 | 1 | — | 아군 하수인 하나에게 +4/+4. 내 턴 종료에 제거됩니다. |
| 흑마법사 | Sense Demons | `demon_seek` | 일반 | 3 | — | 덱에서 악마 2장을 뽑습니다. 부족하면 1/1 임프를 보충합니다. |
| 흑마법사 | Summoning Portal | `demon_gate` | 일반 | 4 | 0/4 | 내 하수인 비용 -2. 이 효과로 1 미만이 되지 않습니다. |
| 흑마법사 | Demonfire | `infernal_fire` | 일반 | 2 | — | 하수인 하나에게 피해 2. 아군 악마이면 대신 +2/+2. |
| 흑마법사 | Felguard | `fel_guard` | 희귀 | 3 | 3/5 | 도발. 전투의 함성: 내 마나 수정 1개 잃음. |
| 흑마법사 | Void Terror | `void_devourer` | 희귀 | 3 | 3/3 | 전투의 함성: 양옆 아군 하수인을 제거하고 현재 공격력과 생명력을 얻습니다. |
| 흑마법사 | Shadowflame | `shadow_flame` | 희귀 | 4 | — | 아군 하수인 하나를 제거하고 그 공격력만큼 적 하수인 전부에게 피해. |
| 흑마법사 | Doomguard | `doom_guard` | 희귀 | 5 | 5/7 | 돌진. 전투의 함성: 무작위 손패 두 장 버림. |
| 흑마법사 | Siphon Soul | `soul_drain` | 희귀 | 6 | — | 하수인 하나 제거. 내 영웅 생명력 3 회복. |
| 사제 | Circle of Healing | `healing_circle` | 일반 | 0 | — | 모든 하수인 생명력 4 회복. |
| 사제 | Silence | `silencing_rune` | 일반 | 0 | — | 하수인 하나 침묵. |
| 사제 | Thoughtsteal | `thought_echo` | 일반 | 3 | — | 상대 덱의 무작위 카드 2장 복사. |
| 사제 | Lightspawn | `light_entity` | 일반 | 4 | 0/5 | 공격력이 자신의 현재 생명력과 같습니다. |
| 사제 | Temple Enforcer | `temple_guardian` | 일반 | 6 | 6/6 | 전투의 함성: 아군 하수인 하나 생명력 +3. |
| 사제 | Inner Fire | `inner_light` | 일반 | 1 | — | 하수인 하나의 공격력을 현재 생명력과 같게 설정. |
| 사제 | Lightwell | `light_well` | 희귀 | 2 | 0/5 | 내 턴 시작마다 피해 입은 무작위 아군 캐릭터 3 회복. |
| 사제 | Auchenai Soulpriest | `shadow_healer` | 희귀 | 4 | 3/5 | 내 치유 효과가 대신 피해를 줍니다. |
| 사제 | Mass Dispel | `mass_dispel` | 희귀 | 4 | — | 적 하수인 모두 침묵. 카드 한 장 뽑기. |
| 사제 | Shadow Madness | `shadow_lease` | 희귀 | 4 | — | 공격력 3 이하 적 하수인을 이번 턴 동안 조종. |
| 사제 | Holy Fire | `holy_flame` | 희귀 | 6 | — | 캐릭터 하나에게 피해 5. 내 영웅 생명력 5 회복. |
| 마법사 | Ice Lance | `ice_lance` | 일반 | 1 | — | 캐릭터 하나를 빙결. 이미 빙결이면 대신 피해 4. |
| 마법사 | Mana Wyrm | `mana_wyrm` | 일반 | 1 | 1/3 | 내 주문 사용마다 공격력 +1. |
| 마법사 | Sorcerer's Apprentice | `spell_tutor` | 일반 | 2 | 3/2 | 내 주문 비용 -1. |
| 마법사 | Cone of Cold | `cold_cone` | 일반 | 4 | — | 하수인 하나와 양옆 하수인을 빙결시키고 피해 1. |
| 마법사 | Ice Barrier | `ice_barrier` | 일반 | 3 | — | 비밀: 내 영웅 공격 시 방어도 8. |
| 마법사 | Mirror Entity | `mirror_entity` | 일반 | 3 | — | 비밀: 적이 하수인을 내면 복사본 소환. |
| 마법사 | Counterspell | `arcane_barrier` | 희귀 | 3 | — | 비밀: 적 주문 취소. |
| 마법사 | Vaporize | `vaporize` | 희귀 | 3 | — | 비밀: 내 영웅 공격 하수인 제거. |
| 마법사 | Kirin Tor Mage | `kirin_mage` | 희귀 | 3 | 4/3 | 전투의 함성: 이번 턴 다음 비밀 비용 0. |
| 마법사 | Ethereal Arcanist | `ether_mage` | 희귀 | 4 | 3/3 | 내 턴 종료 시 비밀이 있다면 +2/+2. |
| 마법사 | Blizzard | `blizzard` | 희귀 | 6 | — | 적 하수인 전부에게 피해 2와 빙결. |
| 사냥꾼 | Scavenging Hyena | `scavenger` | 일반 | 2 | 2/2 | 다른 아군 야수 사망마다 +2/+1. |
| 사냥꾼 | Explosive Trap | `fire_trap` | 일반 | 2 | — | 비밀: 내 영웅 공격 시 적 전체에 피해 2. |
| 사냥꾼 | Freezing Trap | `freeze_trap` | 일반 | 2 | — | 비밀: 적 하수인이 공격하면 손패로 돌려보내고 비용 +2. |
| 사냥꾼 | Snipe | `tripwire` | 일반 | 2 | — | 비밀: 적이 하수인을 내면 피해 4. |
| 사냥꾼 | Deadly Shot | `hidden_arrow` | 일반 | 3 | — | 무작위 적 하수인 하나 제거. |
| 사냥꾼 | Unleash the Hounds | `hound_release` | 일반 | 3 | — | 적 하수인 수만큼 1/1 돌진 사냥개 소환. |
| 사냥꾼 | Misdirection | `misdirection` | 희귀 | 2 | — | 비밀: 내 영웅 공격 시 공격 대상을 다른 무작위 캐릭터로 바꿈. |
| 사냥꾼 | Savannah Highmane | `highmane` | 희귀 | 6 | 6/5 | 죽음의 메아리: 2/2 하이에나 둘 소환. |
| 사냥꾼 | Eaglehorn Bow | `hunter_bow` | 희귀 | 3 | 3/2 | 어느 쪽이든 비밀이 발동하면 내구도 +1. |
| 사냥꾼 | Explosive Shot | `explosive_shot` | 희귀 | 5 | — | 하수인 하나에게 피해 5, 양옆 하수인에게 피해 2. |
| 사냥꾼 | Flare | `flare` | 희귀 | 1 | — | 모든 하수인 은신 해제, 적 비밀 제거, 카드 한 장 뽑기. |
| 성기사 | Eye for an Eye | `eye_for_eye` | 일반 | 1 | — | 비밀: 내 영웅이 피해를 입으면 적 영웅에게 같은 피해. |
| 성기사 | Noble Sacrifice | `noble_sacrifice` | 일반 | 1 | — | 비밀: 적 공격 시 2/1 수호병을 소환하여 대신 공격받게 함. |
| 성기사 | Redemption | `redemption` | 일반 | 1 | — | 비밀: 아군 하수인이 사망하면 생명력 1로 다시 소환. |
| 성기사 | Repentance | `repentance` | 일반 | 1 | — | 비밀: 적이 하수인을 내면 생명력을 1로 설정. |
| 성기사 | Blessing of Wisdom | `wisdom_blessing` | 일반 | 1 | — | 하수인 하나가 공격할 때마다 내 카드 한 장 뽑기. |
| 성기사 | Argent Protector | `silver_protector` | 일반 | 2 | 2/2 | 전투의 함성: 아군 하수인 하나에게 천상의 보호막. |
| 성기사 | Equality | `equality` | 희귀 | 2 | — | 모든 하수인의 생명력을 1로 변경. |
| 성기사 | Divine Favor | `divine_favor` | 희귀 | 3 | — | 적 손패 수와 같아질 때까지 카드 뽑기. |
| 성기사 | Aldor Peacekeeper | `peacekeeper` | 희귀 | 3 | 3/3 | 전투의 함성: 적 하수인 하나의 공격력을 1로 설정. |
| 성기사 | Blessed Champion | `blessed_champion` | 희귀 | 5 | — | 하수인 하나의 공격력 두 배. |
| 성기사 | Holy Wrath | `holy_wrath` | 희귀 | 5 | — | 카드 한 장을 뽑고 그 기본 비용만큼 대상에게 피해. |

## 다섯 번째 묶음: 공용 일반·희귀 76종 (v0.16~0.18)

공용 일반 40종과 희귀 36종. 앞선 공용 기본과 합하면 공용 119종이다.

| 직업 | 원작 식별명 | 프로젝트 ID | 희귀도 | 비용 | 수치 | 대응 효과 |
|---|---|---|---|---:|---|---|
| 공용 | Fen Creeper | `fen_creeper` | 일반 | 5 | 3/6 | 도발 |
| 공용 | Earthen Ring Farseer | `field_medic` | 일반 | 3 | 3/3 | 전투의 함성: 캐릭터 하나 생명력 3 회복. |
| 공용 | Southsea Deckhand | `deckhand` | 일반 | 1 | 2/1 | 무기를 장착한 동안 돌진. |
| 공용 | Silver Hand Knight | `silver_knight` | 일반 | 5 | 4/4 | 전투의 함성: 2/2 종자 소환. |
| 공용 | Young Dragonhawk | `young_hawk` | 일반 | 1 | 1/1 | 질풍 |
| 공용 | Abusive Sergeant | `harsh_sergeant` | 일반 | 1 | 2/1 | 전투의 함성: 하수인 하나 이번 턴 공격력 +2. |
| 공용 | Ironbeak Owl | `silent_owl` | 일반 | 2 | 2/1 | 전투의 함성: 하수인 하나 침묵. |
| 공용 | Spiteful Smith | `weapon_smith` | 일반 | 5 | 4/6 | 격노: 내 무기 공격력 +2. |
| 공용 | Venture Co. Mercenary | `venture_merc` | 일반 | 5 | 7/6 | 내 하수인 비용 +3. |
| 공용 | Wisp | `wisp` | 일반 | 0 | 1/1 | — |
| 공용 | Acolyte of Pain | `pain_scholar` | 일반 | 3 | 1/3 | 피해 받을 때마다 카드 1장 뽑기. |
| 공용 | Argent Squire | `silver_squire` | 일반 | 1 | 1/1 | 천상의 보호막 |
| 공용 | Worgen Infiltrator | `night_cat` | 일반 | 1 | 2/1 | 은신 |
| 공용 | Jungle Panther | `jungle_cat` | 일반 | 3 | 4/2 | 은신 |
| 공용 | Scarlet Crusader | `scarlet_knight` | 일반 | 3 | 3/1 | 천상의 보호막 |
| 공용 | Thrallmar Farseer | `wind_farseer` | 일반 | 3 | 2/3 | 질풍 |
| 공용 | Silvermoon Guardian | `crystal_sentinel` | 일반 | 4 | 3/3 | 천상의 보호막 |
| 공용 | Stranglethorn Tiger | `jungle_tiger` | 일반 | 5 | 5/5 | 은신 |
| 공용 | Leper Gnome | `plague_gnome` | 일반 | 1 | 2/1 | 죽음의 메아리: 적 영웅 피해 2. |
| 공용 | Windfury Harpy | `wind_harpy` | 일반 | 6 | 4/5 | 질풍 |
| 공용 | Dark Iron Dwarf | `iron_dwarf` | 일반 | 4 | 4/4 | 전투의 함성: 하수인 하나 이번 턴 공격력 +2. |
| 공용 | Spellbreaker | `spell_breaker` | 일반 | 4 | 4/3 | 전투의 함성: 하수인 하나 침묵. |
| 공용 | Youthful Brewmaster | `young_brewer` | 일반 | 2 | 3/2 | 전투의 함성: 아군 하수인 하나 손으로 반환. |
| 공용 | Ancient Brewmaster | `old_brewer` | 일반 | 4 | 5/4 | 전투의 함성: 아군 하수인 하나 손으로 반환. |
| 공용 | Mad Bomber | `chaos_bomber` | 일반 | 2 | 3/2 | 전투의 함성: 자신 제외 무작위 캐릭터에게 피해 1씩 3회. |
| 공용 | Loot Hoarder | `courier` | 일반 | 2 | 2/1 | 죽음의 메아리: 카드 한 장 뽑기. |
| 공용 | Dire Wolf Alpha | `pack_wolf` | 일반 | 2 | 2/2 | 양옆 아군 공격력 +1. |
| 공용 | Frost Elemental | `frost_elemental` | 일반 | 6 | 5/5 | 전투의 함성: 캐릭터 하나 빙결. |
| 공용 | Tauren Warrior | `tauren_guard` | 일반 | 3 | 2/3 | 도발. 격노: 공격력 +3. |
| 공용 | Amani Berserker | `scarred_rager` | 일반 | 2 | 2/3 | 격노: 공격력 +3. |
| 공용 | Mogu'shan Warden | `stone_warden` | 일반 | 4 | 1/7 | 도발 |
| 공용 | Shieldbearer | `heavy_shield` | 일반 | 1 | 0/4 | 도발 |
| 공용 | Raging Worgen | `raging_wolf` | 일반 | 3 | 3/3 | 격노: 공격력 +1 및 질풍. |
| 공용 | Harvest Golem | `harvest_golem` | 일반 | 3 | 2/3 | 죽음의 메아리: 2/1 손상 골렘 소환. |
| 공용 | Priestess of Elune | `moon_priestess` | 일반 | 6 | 5/4 | 전투의 함성: 내 영웅 생명력 4 회복. |
| 공용 | Cult Master | `cult_master` | 일반 | 4 | 4/2 | 다른 아군 하수인 사망마다 카드 한 장 뽑기. |
| 공용 | Bloodsail Raider | `blood_raider` | 일반 | 2 | 2/3 | 전투의 함성: 무기 공격력만큼 공격력 증가. |
| 공용 | Dread Corsair | `blade_raider` | 일반 | 4 | 3/3 | 도발. 내 무기 공격력만큼 비용 감소. |
| 공용 | Faerie Dragon | `faerie_drake` | 일반 | 2 | 3/2 | 주문과 영웅 능력으로 직접 지정할 수 없음. |
| 공용 | Flesheating Ghoul | `battle_watcher` | 일반 | 3 | 2/3 | 하수인 사망마다 공격력 +1. |
| 공용 | Ravenholdt Assassin | `raven_assassin` | 희귀 | 7 | 7/5 | 은신 |
| 공용 | Injured Blademaster | `injured_sword` | 희귀 | 3 | 4/7 | 전투의 함성: 자신에게 피해 4. |
| 공용 | Lightwarden | `light_warden` | 희귀 | 1 | 1/2 | 캐릭터가 실제 치유될 때마다 공격력 +2. |
| 공용 | Young Priestess | `young_priestess` | 희귀 | 1 | 2/1 | 내 턴 종료 시 다른 무작위 아군 생명력 +1. |
| 공용 | Alarm-o-Bot | `alarm_bot` | 희귀 | 3 | 0/3 | 내 턴 시작 시 손패 무작위 하수인과 자리 교환. |
| 공용 | Angry Chicken | `angry_chicken` | 희귀 | 1 | 1/1 | 격노: 공격력 +5. |
| 공용 | Sunwalker | `sun_walker` | 희귀 | 6 | 4/5 | 도발, 천상의 보호막. |
| 공용 | Twilight Drake | `twilight_drake` | 희귀 | 4 | 4/1 | 전투의 함성: 내 손패 수만큼 생명력 증가. |
| 공용 | Questing Adventurer | `quest_adventurer` | 희귀 | 3 | 2/2 | 내가 다른 카드를 사용하면 +1/+1. |
| 공용 | Ancient Watcher | `ancient_watcher` | 희귀 | 2 | 4/5 | 스스로 공격할 수 없음. |
| 공용 | Coldlight Oracle | `cold_oracle` | 희귀 | 3 | 2/2 | 전투의 함성: 양쪽 카드 2장씩 뽑기. |
| 공용 | Mana Addict | `mana_addict` | 희귀 | 2 | 1/3 | 내 주문 사용마다 이번 턴 공격력 +2. |
| 공용 | Sunfury Protector | `sun_protector` | 희귀 | 2 | 2/3 | 전투의 함성: 양옆 아군 도발 부여. |
| 공용 | Crazed Alchemist | `mad_alchemist` | 희귀 | 2 | 2/2 | 전투의 함성: 하수인 하나 공격력과 현재 생명력 맞교환. |
| 공용 | Argent Commander | `silver_champion` | 희귀 | 6 | 4/2 | 돌진, 천상의 보호막. |
| 공용 | Pint-Sized Summoner | `tiny_summoner` | 희귀 | 2 | 2/2 | 내 턴 첫 하수인 비용 -1. |
| 공용 | Secretkeeper | `secret_keeper` | 희귀 | 1 | 1/2 | 누구든 비밀을 설치하면 +1/+1. |
| 공용 | Mind Control Tech | `crowd_recruiter` | 희귀 | 3 | 3/3 | 전투의 함성: 적 하수인이 4개 이상이면 무작위 하나 가져오기. |
| 공용 | Arcane Golem | `arcane_golem` | 희귀 | 3 | 4/2 | 돌진. 전투의 함성: 상대 빈 마나 수정 1개 증가. |
| 공용 | Defender of Argus | `banner_captain` | 희귀 | 4 | 2/3 | 전투의 함성: 양옆 하수인 +1/+1 및 도발. |
| 공용 | Gadgetzan Auctioneer | `auctioneer` | 희귀 | 5 | 4/4 | 내 주문 사용마다 카드 한 장 뽑기. |
| 공용 | Abomination | `abomination` | 희귀 | 5 | 4/4 | 도발. 죽음의 메아리: 모든 캐릭터에게 피해 2. |
| 공용 | Demolisher | `demolisher` | 희귀 | 3 | 1/4 | 내 턴 시작 시 무작위 적에게 피해 2. |
| 공용 | Coldlight Seer | `cold_seer` | 희귀 | 3 | 2/3 | 전투의 함성: 양쪽 전장의 다른 모든 멀록 생명력 +2. |
| 공용 | Emperor Cobra | `venom_snake` | 희귀 | 3 | 2/3 | 독성 |
| 공용 | Azure Drake | `azure_drake` | 희귀 | 5 | 4/4 | 주문 공격력 +1. 전투의 함성: 카드 한 장 뽑기. |
| 공용 | Murloc Tidecaller | `tide_caller` | 희귀 | 1 | 1/2 | 다른 멀록이 소환될 때마다 공격력 +1. |
| 공용 | Ancient Mage | `ancient_mage` | 희귀 | 4 | 2/5 | 전투의 함성: 양옆 하수인 주문 공격력 +1. |
| 공용 | Imp Master | `imp_master` | 희귀 | 3 | 1/5 | 내 턴 종료 시 자신에게 피해 1, 1/1 임프 소환. |
| 공용 | Mana Wraith | `tax_collector` | 희귀 | 2 | 2/2 | 양쪽 하수인 비용 +1. |
| 공용 | Knife Juggler | `knife_juggler` | 희귀 | 2 | 3/2 | 다른 아군 하수인 소환마다 무작위 적에게 피해 1. |
| 공용 | Wild Pyromancer | `wild_pyromancer` | 희귀 | 2 | 3/2 | 내 주문 사용 후 모든 하수인에게 피해 1. |
| 공용 | Bloodsail Corsair | `blood_corsair` | 희귀 | 1 | 1/2 | 전투의 함성: 상대 무기 내구도 1 감소. |
| 공용 | Violet Teacher | `violet_teacher` | 희귀 | 4 | 3/5 | 내 주문 사용마다 1/1 수습생 소환. |
| 공용 | Master Swordsmith | `master_smith` | 희귀 | 2 | 1/3 | 내 턴 종료 시 다른 무작위 아군 공격력 +1. |
| 공용 | Stampeding Kodo | `stampede_kodo` | 희귀 | 5 | 3/5 | 전투의 함성: 공격력 2 이하 무작위 적 하수인 제거. |

## 현재 카탈로그와 검증 범위 (v0.19)

- 기본 133 + 일반 94 + 희귀 81 = 308종 덱 카드. 직업 189종 + 공용 119종. 각 직업의 편입 가능 카드 140종. 별도 비수집 정의 24종.
- 이전 개발용 카탈로그 v0.16.0의 덱 카드 366종은 파일로 그대로 보존했다. v0.17.0에서 오리지널 대응 308종만 활성화했다.
- v0.18.0은 주문 사용 전/후 이벤트, 과부하 순서, 2014년 은신 해제, 반환 실패 사망, 침묵과 최대 생명력, 동시 탈진 및 턴 시작 순서를 추가로 검증했다. 참고: [Advanced rulebook](https://hearthstone.wiki.gg/wiki/Advanced_rulebook), [Counterspell](https://hearthstone.wiki.gg/wiki/Counterspell), [Stealth](https://hearthstone.wiki.gg/wiki/Stealth), [2014년 Sap 논의](https://www.hearthpwn.com/forums/hearthstone-general/card-discussion/21014-sap-triggers-deathrattle).
- v0.19.0에서 2014년 6월과 이후 패치의 차이를 재검증하여 멀록 강화 효과가 상대 멀록에도 적용되고, 사냥꾼의 활은 양쪽 비밀 공개에 반응하도록 수정했다. 참고: [2016-10-20 공식 멀록 패치](https://hearthstone.blizzard.com/en-gb/news/20328179/hearthstone-update-october-20-2016-10-20-2016), [2014-07-22 무기 변경 이력](https://hearthstone.wiki.gg/wiki/Eaglehorn_Bow), [턴 수 제한](https://hearthstone.wiki.gg/wiki/Turn).
- v0.20.0~v0.21.0: 배신 피해 원천, 1생명력 보호, 소환의 문 할인 우선순위, 하수인 생성 토큰의 인접/사망 위치, 과부하 카드 사용과 실제 잠금 시점 분리, 현재 조종자 손패 반환 및 침묵/변신 시 임시 조종 처리를 보강했다. 참고 자료: [2017년 공식 배치 설명](https://hearthstone.blizzard.com/en-gb/news/21295165/what-sets-the-pros-apart-board-positioning), [게임 비용 규칙](https://hearthstone.fandom.com/wiki/Mana_cost), [과부하 카드와 주문 차단](https://hearthstone.wiki.gg/wiki/Counterspell), [2014년 조종된 하수인 반환 사례](https://gaming.stackexchange.com/questions/168691/should-a-freezing-trap-return-a-stolen-minion-to-my-hand), [임시 조종 상호작용](https://hearthstone.wiki.gg/wiki/Shadow_Madness). 후대 자료도 참고하였으므로 모든 2014년 특수 상호작용이 완전히 검증됐다고 주장하지 않는다.
- 카드별 데이터와 대표 효과는 구현했지만, 모든 2014년 판정의 조합 및 원작의 재현 정확도는 추가적인 수동 대전 검증이 필요하다. 독립적인 게임으로 유지한다.

## v0.31.0: 2014년 6월 영웅 등급 카드 38종

직업별 영웅 카드 3종씩(27종) + 공용 11종(보상 카드 선장의 앵무새 포함)을 추가했다. 2014년 6월 클래식 기준 덱 카드 382종 중 전설 36종을 제외한 346종과 대응한다. 세트 분류는 기본 133종 및 오리지널 일반 94·희귀 81·영웅 38종을 유지한다. 별도 생성 토큰 4종(뱀, 돌진 나무정령, 주문왜곡사, 허무의 그림자)을 추가해 JSON 정의 374종, 엔진 동전·영웅 능력 토큰 포함 표시용 정의 380종이다. 각 직업은 자기 직업 24종과 공용 130종을 합친 154종을 덱에 사용할 수 있다.

| 프로젝트 ID | 표시 이름 | 마나 | 공격/생명력·내구도 | 역사 식별 ID |
|---|---|---:|---|---|
| `brawl` | 난투 | 5 | — | VAN_EX1_407 |
| `shield_slam` | 방패 밀쳐내기 | 1 | — | VAN_EX1_410 |
| `gorehowl` | 피의 울음소리 | 7 | 7/1 | VAN_EX1_411 |
| `far_sight` | 천리안 | 3 | — | VAN_CS2_053 |
| `doomhammer` | 둠해머 | 5 | 2/8 | VAN_EX1_567 |
| `earth_elemental` | 대지의 정령 | 5 | 7/8 | VAN_EX1_250 |
| `preparation` | 마음가짐 | 0 | — | VAN_EX1_145 |
| `patient_assassin` | 침착한 암살자 | 2 | 1/1 | VAN_EX1_522 |
| `kidnapper` | 납치범 | 6 | 5/3 | VAN_NEW1_005 |
| `lay_on_hands` | 신의 축복 | 8 | — | VAN_EX1_354 |
| `avenging_wrath` | 응징의 격노 | 6 | — | VAN_EX1_384 |
| `sword_of_justice` | 정의의 칼날 | 3 | 1/5 | VAN_EX1_366 |
| `bestial_wrath` | 야수의 격노 | 1 | — | VAN_EX1_549 |
| `snake_trap` | 뱀 덫 | 2 | — | VAN_EX1_554 |
| `gladiators_longbow` | 검투사의 장궁 | 7 | 5/2 | VAN_DS1_188 |
| `force_of_nature` | 자연의 군대 | 6 | — | VAN_EX1_571 |
| `ancient_of_lore` | 지식의 고대정령 | 7 | 5/5 | VAN_NEW1_008 |
| `ancient_of_war` | 전쟁의 고대정령 | 7 | 5/5 | VAN_EX1_178 |
| `twisting_nether` | 뒤틀린 황천 | 8 | — | VAN_EX1_312 |
| `bane_of_doom` | 파멸의 저주 | 5 | — | VAN_EX1_320 |
| `pit_lord` | 지옥의 군주 | 4 | 5/6 | VAN_EX1_313 |
| `pyroblast` | 불덩이 작렬 | 10 | — | VAN_EX1_279 |
| `ice_block` | 얼음 방패 | 3 | — | VAN_EX1_295 |
| `spellbender` | 주문왜곡사 | 3 | — | VAN_tt_010 |
| `shadowform` | 어둠의 형상 | 3 | — | VAN_EX1_625 |
| `cabal_shadow_priest` | 비밀결사단 어둠사제 | 6 | 4/5 | VAN_EX1_091 |
| `mindgames` | 심리 조작 | 4 | — | VAN_EX1_345 |
| `doomsayer` | 파멸의 예언자 | 2 | 0/7 | VAN_NEW1_021 |
| `big_game_hunter` | 나 이런 사냥꾼이야 | 3 | 4/2 | VAN_EX1_005 |
| `blood_knight` | 혈기사 | 3 | 3/3 | VAN_EX1_590 |
| `faceless_manipulator` | 얼굴 없는 배후자 | 5 | 3/3 | VAN_EX1_564 |
| `murloc_warleader` | 멀록 전투대장 | 3 | 3/3 | VAN_EX1_507 |
| `southsea_captain` | 남쪽바다 선장 | 3 | 3/3 | VAN_NEW1_027 |
| `hungry_crab` | 굶주린 게 | 1 | 1/2 | VAN_NEW1_017 |
| `sea_giant` | 바다 거인 | 10 | 8/8 | VAN_EX1_586 |
| `mountain_giant` | 산악 거인 | 12 | 8/8 | VAN_EX1_105 |
| `molten_giant` | 용암 거인 | 20 | 8/8 | VAN_EX1_620 |
| `captains_parrot` | 선장의 앵무새 | 2 | 1/1 | VAN_NEW1_016 |

비교 출처: [Blizzard 20.0 패치 공지](https://hearthstone.blizzard.com/en-us/news/23642550/), [Classic format 카드 집계](https://hearthstone.wiki.gg/wiki/Classic_format), [Bane of Doom 변경 이력](https://hearthstone.wiki.gg/wiki/Bane_of_Doom), [Gladiator's Longbow 변경 이력](https://hearthstone.wiki.gg/wiki/Gladiator%27s_Longbow), [Spellbender 판정](https://hearthstone.wiki.gg/wiki/Spellbender), [Shadowform (Classic)](https://hearthstone.wiki.gg/wiki/Shadowform_(Classic)), [Captain's Parrot (Classic)](https://hearthstone.wiki.gg/wiki/Captain%27s_Parrot_(Classic)).

파멸의 저주는 2015년 변경 이전 6종 악마 풀만 사용한다. 검투사의 장궁은 2016년 변경 이전 전투 피해 면역(공격 선언 비밀 피해는 방지하지 않음)으로 구현한다. 주문왜곡사는 타겟 조건을 만족하지 않는 경우에도 주문의 대상으로 바뀌며, 무작위 대상/영웅 대상 주문에는 발동하지 않는다. 어둠의 형상은 영웅 능력을 교체·강화할 때만 다시 사용할 수 있다. 현대판의 4마나·2장 드로우 변경 등을 혼용하지 않는다. 모든 복잡한 과거 버그·동시 발동 타이밍 및 수동 플레이 검증을 마쳤다는 의미는 아니다.
