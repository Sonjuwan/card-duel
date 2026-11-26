# Card Duel 변경 이력 감사

## 기준점

- 최적화 이전 비교 기준은 사용자 지시에서 완료로 확인한 영웅 개편의 공개 v0.319.0 소스 `0283a83`이다. HANDOFF와 당시 Pages 기록에서 확인했다.
- 비교한 중간 체크포인트는 첫 성능 브랜치 `1168d82`, 공개 v0.322.0 `fbf2014`, 공개 v0.323.0 `15802d0`, 릴리스 v0.324.0 `0b502a1` / v0.325.0 `b06e928` / v0.326.0 `732d89f`다.
- 개발 시작점은 공개 v0.327.0 소스 `a4b09cb`이다. 통합 브랜치 `d4832e9` 이후 로그 입력과 하수인 폭 수정이 적용됐다. 실제 Pages `dc6a522` 및 공개 메타데이터의 릴리스 ID `233eab1e1504`를 대조했다.

## 변경 분류 및 결정

| 분류 | 근거 | 처리 |
|---|---|---|
| 요청에 따른 변경 | `a4b7f90`의 터치 고정 상세, `29d68c9`·`0a1fc6b`의 별도 덱 추가 및 도감 검색, `70219aa`·`f26f481`의 소환 음성·중첩 타격음·종료 가능 표시 | 최신 개발 지시와 일치하므로 유지 |
| 순수 최적화 | `fdd10b7` 검색 필드 캐시, `e2de210` 로그 재사용, `bde780d`·`b77f54b` 캐시 무결성 및 재사용, `3aeaee8` 공개 로그 복제 | 기존 출력·저장·업데이트 검증을 확인. 이번 후보에서 다시 회귀 검사 |
| 순수 최적화 | v0.324.0 정적 UI·FX 메모이제이션, 단일 순회 대상 스냅과 삽입 위치, 슬롯 읽기·원자적 프로필 저장 재사용. v0.325.0 도감·덱 집계 캐시 | 변경 범위를 보존. 성능 후보 기록의 브라우저 전체 실측과 함수 표본을 구분 |
| 순수 최적화 | `359daff` 계열의 AI 상대 샘플링 덱 캐시 | 불변 카탈로그·직업별 연습 덱만 캐시. RNG·가중치·후보 채택 로직은 동일. 고정 노드 비교 명령으로 추가 확인 |
| 이미 대체되거나 잘못 구현된 요청 | `29b1208`의 모바일 4등분이 `d4aff3e`의 손패 전용 행에서 대체됨. 큰 화면 상대 손패 상단 행 및 로그 표시 충돌도 남아 있음 | 모바일 4행과 손패 오버레이, 큰 화면 상대 손패·로그 및 확대 손패를 별도 단계에서 정리 |
| 변경 목적·승인 추가 확인 | 공개 v0.327.0의 턴·예약 UI 예측, 음성 큐 수명과 일부 CSS 우선순위가 이전과 다름. 음향 기능 요구와 겹치므로 동작 기본값·물리 기기 검증을 근거로 판단 | 발견만으로 되돌리지 않음. UI 예측은 서버 판정과 분리. 모바일 실기기 음향·성능 미검증 |
| 사용자 요청 없는 설정 변경 | 아래 비교에서 되돌릴 근거가 있는 기본값은 확인되지 않음 | 저장된 개인 설정을 초기화하거나 기존 값에 덮어쓰지 않음 |
| 부적합한 최적화 | 이미지 분리 `be6dc6e` 및 전투 조회·터치 `ca2f43c` | 최초 설치 또는 CPU 제한 프레임에서 회귀하여 안정 소스에 포함하지 않음 |

카드 및 일러스트 Git 트리(카드 `7da4c44`, 그림 `c734bf5`)는 기준과 v0.327.0이 동일하다. `data/ai`, 성장 규칙 `packages/progression.ts`, AI 프로필, 로컬 전투 기본 설정·진동·자막 저장 키는 비교 범위에서 변경되지 않았다. 전투 엔진의 규칙 변경은 없고 이 범위의 엔진 변경은 공개 로그 투영이다. 전체·효과음·대사 볼륨 기본값은 100·75·90으로 유지됐다. 기존 음악 설정과 연출 속도 설정은 코드에 존재하는 기능을 기준으로 UI 단계에서 확인한다. 위 판단은 Git에 보존된 소스와 배포 산출물에 근거하며, 사용자의 기기 내부 값은 접근하지 않았다.

## 커밋 인덱스

아래는 기준 이후 v0.327.0에서 도달 가능한 커밋 전체다. 같은 작업을 서로 다른 브랜치에서 검증한 커밋도 포함된다.

```text
fdd10b7 Measure runtime baseline and reuse normalized card search fields
bde780d Reuse verified unchanged assets when installing PWA updates
5782245 Isolate battle countdown ticks and verify a real prior PWA update
e5dac43 Avoid duplicate hit tests during touch dragging
cbfb4fa Record startup and storage profiles with a stable optimization checkpoint
b77f54b Reuse installation verification for the first offline reload
e2de210 Reuse public battle logs across interaction renders
fbf2014 Record deterministic CPU-throttled frame measurements
3aeaee8 Reduce public battle history snapshot cloning cost
62bef51 Use direct DOM lookup for single combat effect targets
6b2cb15 Compare heap snapshots after repeated game restoration
15802d0 Keep verified runtime after measuring installation and combat experiments
8662176 perf: reuse static art components on v0.323
f838fb1 perf: isolate static tabletop SVG from battle rerenders
d0de647 perf: skip hidden-hand rendering until opponent card count changes
4c2a9e7 test: preserve static art, hidden hand counts and unique tabletop ids
60a88d0 perf: isolate mana and deck readouts by scalar state, memoize static glyphs
2897d41 perf: isolate BattleEffects from unrelated battle rerenders
1d73b0b perf: isolate ImpactRail and ImpactHistory from unrelated battle rerenders
e5617f2 perf: isolate DialogueCaptions from unrelated battle rerenders
3b02d73 perf: preserve filtered impact history identity between UI updates
ff1ed3d perf: retain stable empty impact history during room transitions
0413767 perf: select nearest touch target in one pass without allocating and sorting candidates
3edb488 test: compare linear touch target selection against sorted reference in 30000 seeded cases
e64197d perf: find visible insertion slot without per-pointer temporary arrays
79ffb5b test: differential coverage for clipped insertion slot geometry
1f12d50 test: preserve resource readouts and charging states after render isolation
5ab63dd perf: add reproducible touch geometry microbenchmark against v0.323 reference
0cb6052 docs: record v0.323 optimization evidence and required validation checkpoint
5038494 test: profile drag CSS variable writes separately from frame timing
683ac05 test: add fixed-node AI benchmark with ranked and accepted action fingerprints
068a33c perf: aggregate battle impact feedback in one pass without temporary arrays
a9a1b54 test: retain reference comparison for 30000 mixed impact feedback cases
6e3390a docs: checkpoint drag diagnostics, AI fingerprinting and impact optimization
d34d28f ci: verify performance candidate in read-only Node 24 and Chromium jobs
2024d92 ci: generate standalone HTML prerequisite before regression suite
37280c6 ci: generate installable PWA before packaging verification
ad8fdf6 ci: compare baseline and candidate combat, drag, bundle and fixed-node AI measurements
293d04b ci: independently profile combat, fixed-node AI, and actual grouped PWA experiment
9723bac perf: adopt benchmark-validated AI opponent deck cache and ranking regression
359daff perf: adopt benchmark-validated AI opponent deck cache and ranking regression
2c5fdde perf: reuse slot preview scan rather than cloning the same checkpoint twice
a3693b8 perf: skip checkpoint cloning when save ownership already prevents writing
6bfff26 test: assert slot preview reads each checkpoint only once without changing privacy or ownership
112b51d refactor: centralize the identical online and offline stylesheet import lists
dc90a62 refactor: use shared stylesheet entry without changing cascade order
8090f0c refactor: use shared stylesheet entry without changing cascade order
09711b0 perf: release completed or cancelled speech callbacks and watchdog references
26cd3c7 test: completed speech releases native callbacks before advancing queue
9fe7490 test: keep a single shared stylesheet entry with the verified cascade order
880e6bf audit: enumerate compiler-confirmed unused locals and shared CSS layer inventory
2990f6c perf: add read-only physical Android thermal, battery and browser memory sampling
b6d1f30 ci: cover all checklist areas with lifecycle, source audit and isolated drag comparisons
96cfcc4 perf: integrate follow-up ledger validation and stylesheet regression corrections
bbf2a28 perf: integrate follow-up ledger validation and stylesheet regression corrections
a0e84d4 perf: integrate follow-up ledger validation and stylesheet regression corrections
a710c9e perf: adopt measured overlay-scoped drag styling after three passing comparisons
d9603fe docs: preserve measured combat comparison and scoped drag adoption evidence
499dc3e ci: recheck adopted drag scope against pre-scope baseline and run audit before regression
ad61103 ci: verify growth write and countdown wake optimizations with browser comparisons and art inventory
ec9487e cleanup: remove compiler-confirmed unused bindings
dc3d90f cleanup: remove compiler-confirmed unused bindings
4e65bbd cleanup: remove compiler-confirmed unused bindings
87ba595 cleanup: remove compiler-confirmed unused bindings
6aae28b cleanup: remove compiler-confirmed unused bindings
99f5261 cleanup: remove compiler-confirmed unused bindings
31f7894 perf: adopt validated redundant growth-write and countdown-wake reductions
ac10d3b perf: adopt validated redundant growth-write and countdown-wake reductions
eed70eb perf: adopt validated redundant growth-write and countdown-wake reductions
f616937 perf: adopt validated redundant growth-write and countdown-wake reductions
cb16a10 perf: adopt validated redundant growth-write and countdown-wake reductions
3bc1d0a audit: retain exact WebP asset inventory and compression measurements
024cc2a audit: allow strict zero-unused-declaration verification
185b602 perf study: test smaller pixel-identical WebP encodings on largest assets without modifying production art
42b261e ci: enforce zero unused bindings, recheck adopted storage reduction and screen exact-pixel image encodings
76a2a4d docs: record validated storage reductions, unused-binding cleanup and lossless asset study
b22843c perf: reuse collection pages and membership sets; release completed save-probe worker references
8592a85 test: confirm cached collection pages preserve every filtered and clamped selection
2a971d2 docs: record 985 passing regressions, rejected lossless art sample and collection follow-up
7d80169 perf: adopt committed ranked profile reuse after passing atomic storage and browser checks
cdf4e06 perf: adopt committed ranked profile reuse after passing atomic storage and browser checks
dcbf3eb perf: adopt committed ranked profile reuse after passing atomic storage and browser checks
997b8e9 perf: adopt committed ranked profile reuse after passing atomic storage and browser checks
b89a364 perf: profile active gameplay and repeated finished matches with heap and compositing diagnostics
8157ce2 perf: require authoritative end-turn acknowledgments in active lifecycle profile
e3153a4 perf: use the accessible mobile concede control during repeated gameplay profiling
6e89adc ci: measure repeated active combat and menu recovery, not only mulligan restore cycles
7bc5cfa docs: record completed validation and adopt atomic storage results; retain isolated engine experiment
20d1285 test: acknowledge normal reward dialog in repeated finished-match profile
526d687 release: label verified optimization candidate v0.324.0
62e1edf release: label verified optimization candidate v0.324.0
d40c47e release: label verified optimization candidate v0.324.0
3d8b92b release: build and verify actual v0.323 migration, publish v0.324 only after all gates pass
ad8e11b test: verify shared stylesheet entry and cascade order instead of obsolete direct imports
896994b test: verify shared stylesheet entry and cascade order instead of obsolete direct imports
0b502a1 ci: restart release gate on corrected source commits
79948a5 feat: distinguish pinned tap inspection from hover and drag gestures
56831b5 feat: open persistent preview on stationary touch release while preserving ordinary hover
6db14f7 feat: dismiss pinned details on a new physical press, escape or screen change
a4b7f90 feat: inspect hand and field cards by touch without consuming them; targeted actions keep priority
4a44987 test: persistent touch inspection, movement rejection, updated details and dismissal
3a84fc3 test: validate tap previews persist and outside touches dismiss without changing card geometry
29d68c9 feat: separate deck browsing from adding, move catalog filters into dedicated dialog
0a1fc6b feat: full card inspector with separate add action, live copy count and backdrop dismissal
63d2a00 ui: reserve compact mobile collection space and keep explicit deck addition in card detail
4e82480 test: keep UI assertions aligned with explicit tap inspection and add controls
fb79dcf test: keep UI assertions aligned with explicit tap inspection and add controls
230b328 test: keep UI assertions aligned with explicit tap inspection and add controls
3a729d1 test: exercise real mobile catalog filters, detail, explicit deck addition and responsive page bounds
b88d923 ci: verify non-image touch and collection updates before integration
b8d3fda fix: retain literal preview side types in shared reader
09a0014 test: require pinned inspection and preserve targeted action priority
e130483 test: require pinned inspection and preserve targeted action priority
6f00f6b perf: count collection sets in one pass
253a4f4 perf: reuse card set totals, deck rows and mana curve; avoid hidden detail updates on pointer hover
ca07531 perf: allow modal contents to release on close
5b8dc53 perf: unmount unused card detail content after modal closes
e7240b6 perf: stop repeated preview cancellation and distance checks after drag threshold
637dbd6 perf: calculate live preview status tags once per render
a93406f test: compare optimized set totals with original filters across catalog subsets
353ee18 test: verify drag cancellation work drops to one transition per gesture
bd7dc73 test: verify on-demand catalog filter dialog while preserving eight-card geometry
73fdb54 fix: revalidate owned and class-legal card before new detail-modal add action
4c3e410 perf test: compare new collection counting and drag transition against previous algorithms
db4792d ci: separately benchmark new UI code and check unused bindings
e24e8c2 test: navigate installed app through actual play and hero selection to deck editor
02bba06 fix: free two card-add rows on landscape tablets and short desktop screens
2507383 test: diagnose clipped card geometry, verify closed detail cleanup and 4:3 tablet layout
93b90da ci: run browser regression independently of core tests and check collection layout first
bbd7730 release: prepare v0.325.0 verified UI and optimization candidate
4c6e626 release: prepare v0.325.0 verified UI and optimization candidate
42be9bc release: prepare v0.325.0 verified UI and optimization candidate
b06e928 ci: publish v0.325.0 only after full build, mobile checks and actual v0.324.0 update verification
8c86066 fix: put collection filters and deck management in one toolbar, remove duplicate deck count and catalog sidebar
35ec1b9 ui: put catalog filter first in header and keep developer totals alongside
0ca537b fix: allocate toolbar, tabs, pages and eight card cells from actual workspace height
ed26e45 ui: use dedicated shared collection layout stylesheet after legacy presentation rules
853c4e5 test: assert new shared collection layout markup
0b085d7 test: assert new shared collection layout markup
bcda52a test: verify all eight cards, actual hit testing, ancestor clipping and header placement on compact mobile and tablet sizes
cc33dca ci: independently verify mobile collection visibility and regression with screenshots
7da10e9 test: include shared collection geometry in ordered online/offline stylesheet manifest
1a23278 release: prepare collection layout repair v0.326.0
2f02e0a release: prepare collection layout repair v0.326.0
e42e511 release: prepare collection layout repair v0.326.0
e573a32 ci: validate and publish collection layout repair against actual installed v0.325.0
0ca0eb9 ci: cancel superseded prepublication release checks when a visual fix arrives
9218c0d fix: keep mana badge inside card, reserve unobscured page footer and center save text
12549cb test: ensure mana badges, page number and centered save label are visible in actual mobile screenshots
732d89f test: require count only in live deck sidebar, not removed duplicate toolbar count
a832cb8 Integrate battle targeting, reserved hero effects and audio feedback
70219aa Continue audio playback across cues and connect collection navigation
29b1208 Implement four equal phone battle rows and independent large layout
f26f481 Complete legal-action prompt and resource previews; add integration verification
5dfd4a4 Fix greeting lifecycle and test exhausted turns and power reservations
009166e Build before installer regressions and verify new catalog behavior
d4aff3e Repair friendly minion height, reserve mobile hand strip and preserve chained card input
a3a815a Prevent hand/resource overlap, restore blank deck entry and verify staged touch targeting
d4832e9 Handle staged target touch releases explicitly, stabilize large hand cards and test cross-class navigation
f207596 Prepare v0.327.0 with mandatory full release verification and pinned PWA upgrade baseline
e1d5794 Fix floating combat history rail swallowing empty board taps
a4b09cb Keep friendly and enemy minion widths identical across board counts
```

## v0.328.0 복구 중 확인한 구체적 회귀

- 공개 v0.327.0에서 페이지 이동 버튼이 책 높이보다 짧은 문제를 동일 Chromium 통합 테스트로 재현했다. 버튼의 실제 클릭 영역을 양옆 페이지 높이에 맞췄다.
- 모바일에서 도감 필터 사이드바만 숨기고 대체 진입을 두지 않은 상태였다. 기존 상태와 필터 기능을 재사용하는 대화상자를 연결했고 화면 비율 전환 시 필터를 초기화하는 동작을 제거했다.
- 큰 화면에는 상세 오버레이와 카드 본체 확대가 동시에 적용됐다. 확대는 100ms 상세 카드에 적용하고 손패 클릭 영역과 원본 카드는 고정했다.
- 설정 패널의 기존 래핑 규칙 때문에 좁은 화면에서 콘텐츠가 패널 밖으로 이동했다. 세로 스크롤을 하나만 사용하고 제목·계속 버튼을 패널 안에서 확인했다.
- AI 모델과 수치, 기존 카드·영웅 자산은 감사 단계에서 확인한 상태를 사용한다. 음악은 공개본에 재생 설정이 없음을 기존 브라우저 검사에서 확인했고 전투 속도는 대전 시작 시 저장된 설정을 유지한다.
