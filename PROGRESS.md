## 2026-11-28 — RUNEHALL v0.337.0

- The published PWA uses the Runehall brand, three-column home, independent phone layout, class growth and a shared visual theme. The original app identity, scope and slot keys continue to resolve the same data.
- Account levels use existing lifetime XP. Class levels use eligible match and assigned quest XP. Earlier class records are restored from stored receipts. The baseline cards, unlock order and quest rewards are independent of these levels.
- To adjust future pacing, edit `data/progression/levels.json`. For level n, the cost to reach n + 1 is `base + step × (n - 1)`. The five mastery thresholds are visual only.

## 2026-11-23 — v0.285.0 isolated card-inspector dialog candidate
- Opening the public card inspector previously trapped keyboard Tab inside the dialog but left the original battle and mulligan UI accessible to other input/assistive-technology navigation. While inspection is active, the title, controls, battle arena, options history and mulligan arena are now `inert`; the inspector itself remains an independent accessible modal. Previously focused trigger receives focus **after React removes inert**, via requestAnimationFrame; Escape/close still does not play a card or change selection.
- Updated existing inspector/history focus regressions and added two modal-isolation tests. Playable-core **631/631**, TS/TSX syntax-only **65/65**, catalog/AI hashes unchanged; no Node24 full React production build or live mobile verification.
- Card mechanics, saves, original AI checkpoints and 25-stage difficulty skeleton unchanged.

## 2026-11-23 — v0.284.0 safe save warnings without battlefield reflow candidate
- Hide the previous-save timestamp whenever the currently active local match save is unconfirmed; it could otherwise appear alongside a genuine failed-save warning and mislead the player. Keep the existing warning and retry controls intact.
- Compact landscape phone error and update messages are positioned in a safe-area-aware overlay with internal scrolling and >=44px dismiss/retry controls, so they cannot expand the fixed battlefield or introduce document-level scrolling. Live browser pixel testing is still required.
- Added two targeted regression cases. Dependency-free playable-core **629/629** and frontend syntax **65/65** passed; original 437 catalog entries, original 2 AI champions and hashes unchanged. Source-only candidate, no latest production React/PWA compile. No rules/AI training/save schema changed.

## 2026-11-23 — v0.283.0 compact landscape save-control priority candidate
- Fixed short, touch-landscape header congestion: save retry and Save/Leave now precede secondary record/audio controls, use concise visual labels on small screens while retaining full action-specific `aria-label`s. Preserve a legible save status and 44px+ primary save controls even at 540px or less landscape height. Desktop still shows original full labels. No changed save handler or data schema.
- Added two static source/CSS regressions; **627/627** dependency-free playable-core, **65/65** TS/TSX syntax-only, approved 437 catalog/2 AI champion checksums, 2 short AI game journeys (85 moves, two restores) passed. Full Node24 production React build and physical-device rendering remain unverified; v0.197 binary is the latest compiled verified gameplay.
- No AI strength calibration, training, online connection, card data or engine balance updates.

## 2026-11-23 — v0.282.0 compact audio and dialogue settings menu candidate
- Previously a permanent effect-sound toggle plus full dialogue/FX settings disclosure crowded the small landscape battle header and forced Save/Leave below the usable area. Moved these existing controls **without changing audio state or callbacks** under a single concise '소리·연출' details disclosure. Mobile opener is >=44px; settings live in a safe-area-aware, height-limited independently scrollable popover. A separate background click-catcher closes it without handing the same tap to a card or the end-turn button; Escape and Tab/Shift+Tab maintain keyboard access. Desktop retains all controls behind the same explicit disclosure.
- Added three source/CSS regressions; **625/625 playable-core** and **65/65 TS/TSX syntax** passed, original data hashes unchanged. Full production Node24/React build and real handset audio/UI remain unverified; PWA playtest binary still v0.197 gameplay.
- Card mechanics, AI strength/25-slot policy, rewards and save format unchanged.

## 2026-11-23 — v0.281.0 priority end-turn and safe surrender menu candidate
- Protected the **turn-end button (>=44px)** in compact/coarse landscape while reducing right-hand HUD congestion: the infrequent, dangerous Surrender control is available only inside the v0.280 full-screen "기록" drawer on touch landscapes <=760px height; desktop remains unchanged. Both UI placements call the **same** existing confirmation-and-concede function, with disabled state guarding busy/disconnected games. The match timer/mana rail and original turn action are not changed.
- New tests assert the primary turn control remains independently >=44px and both surrender paths use exactly the same confirmed game action. **622/622 playable-core**, **65/65 TS/TSX syntax**, approved original card/AI checksums unchanged. PWA/React full build and actual mobile game experience remain to be validated outside this environment.
- No AI training/difficulty calibration, balance, save schema or engine rule modifications.

## 2026-11-23 — v0.280.0 immersive battle history drawer candidate
- Saved 44px of precious landscape battle height by moving noncritical match history, card details and bug-report controls into an explicit "기록" disclosure. On touch landscape <=760px height the battle utility region is `display:none` until the dedicated 44px toolbar button opens a safe-area-aware full-viewport, internally scrollable sheet. On desktop with fine pointer, legacy visible history remains. The arena, titles, and action strip become `inert` while the modal is open, Tab/Shift+Tab is contained and Escape/close restores focus only after React removes inert state.
- Two focused source/CSS regressions validate overlay and keyboard behavior. **620/620 playable-core**, **65/65 frontend syntax**, and 2 complete AI test matches (85 actions/two restore cycles) passed; unchanged approved 437-card catalog and existing AI models. No latest Node24 React build/actual device verification, v0.197 compiled playtest remains distinct.
- All game mechanics/save schema/25-rank AI checkpoints unchanged; history is purely a UI presentation change.

## 2026-11-23 — v0.279.0 no document scrolling during landscape battles candidate
- Found a layout conflict: landscape root and screen-content were fixed, but `>.duel-screen` retained an `overflow-y:auto` fallback, allowing the entire arena to pan as action buttons and target pickers grew. Active and completed landscapes now explicitly use `overflow:hidden`, while the battlefield flexes to remaining height. Small devices retain a guaranteed 44px independent battle-history scroll strip; deck-making and setup scroll behavior remain unchanged.
- Two CSS regression cases verify no screen scrolling and independent log scroll. **618/618** playable-core, **65/65** TS/TSX syntax passed; browser pixel-level rendering still unverified due to lack of Node24+Vite dependencies/Chromium privileges. v0.197 remains last fully built gameplay.
- Card mechanics, AI/checkpoints, scores and saved-game format unmodified.

## 2026-11-23 — v0.278.0 readable opening-hand selection candidate
- The original compact 3/4-card mulligan row made full card text effectively illegible in landscape. The right-side, independently scrollable mulligan heading now contains a 44px touch-target card selector and a separate 44px **카드 설명 확대** control, opening the same accessible notch-safe full description dialog used during battle. Choosing a card to read does **not** change the replacement selection; touching a card still toggles only its replacement state and updates the selector. The dialog is rendered outside the clipping mulligan arena; Escape/close restores focus.
- 616/616 dependency-free playable-core regressions (one new mulligan inspection regression), TS/TSX syntax parse 65/65, approved original card/AI data unchanged. No full Node24+React/Vite build or real mobile rendering has been claimed.
- The existing engine, turn rules, card values, original champions, save format and 25 AI difficulty data were not modified.

## 2026-11-23 — v0.277.0 immersive hand-card full description candidate
- Added a dedicated >=44px '카드 설명 확대' action for the currently selected hand card, including otherwise unplayable hand cards revealed by tapping once. It opens the existing notch-safe, independently scrolling, focus-trapped public card inspector without issuing a game command, changing action/target selection, or altering drag targets. Escape and the close button return focus to the trigger; the dialog now has a general '카드 상세' accessible name.
- Core 615/615, frontend TS/TSX syntax 65/65, offline AI game journey 2/2 games (85 actions, two restore cycles), approved 437-entry catalog and original AI checksums passed. Full Node24/Vite production build and physical mobile interaction remain blocked/unverified, thus this is source candidate only and v0.197 remains compiled playtest.
- Original game engine, card balance, saved-game schema and AI policy/training unchanged.

## 2026-11-23 — v0.276.0 reproducible safe PWA playtest packager candidate
- Added a deterministic `scripts/package-pwa-playtest.mjs` for a **hostable HTTPS playtest ZIP**. It fails closed on dirty/wrong Git HEAD, verifies the original v0.197 compiled JS/CSS against the single-file HTML and re-generated PWA shell, calls `loadSoloRelease` to verify all SHA-256 assets and service-worker release id, writes `CHECKSUMS.sha256` and Korean-independent hosting/install guidance clearly labelling v0.197 gameplay + v0.276 installer, then integrity-tests the ZIP. No unbuilt v0.276 React game is falsely labelled playable.
- Added an additional live worker-protocol test demonstrating: initial IndexedDB failure → user plays a valid mulligan → storage recovers → explicit Save/Leave atomically claims the original empty slot and preserves the advanced revision → Resume returns the same match. **614/614 playable-core**, **18/18 PWA**, **65/65 syntax**; offline AI match 2/2, 85 actions, 2 restores. Node24/full browser and physical device not validated. Original AI/card/reward data unchanged.
- Published ZIP is for HTTPS static hosting; an internet public deployment has not been performed.

## 2026-11-23 — v0.275.0 retryable fresh-practice save claim candidate
- Found a genuine save dead end: if the *first* IndexedDB save of a newly started unranked game throws (temporary quota/permission/open failure), the worker has not yet claimed ownership; earlier logic permanently disabled `persist` and `retrySave` even after storage recovers, so continued progress was never durable. Introduced a narrowly scoped, temporary **initial claim retry** using the exact original `replaceSave` version (`null` if the slot was empty). Later actions, Pause and manual Retry can all attempt that fenced claim without starting over.
- An explicit `store.write=false` ownership/version conflict DISABLES retry and refreshes authoritative save; an intervening other tab cannot be overwritten. Ranked-match starts still fail closed if their initial save fails. Two real worker protocol tests prove success after transient outage and rejection when a second tab wins the save; **613/613 playable-core**, **65/65 frontend syntax**, previous validated AI data preserved. Full React/Node24/physical browser still not verified.
- This does not modify card balance, AI policy/training/checkpoints, serialized save schema or XP rules.

## 2026-11-23 — v0.274.0 unsaved completed-match protection candidate
- Found a legitimate lost-result path: an offline match could finish while IndexedDB save was unavailable; `shouldWarnLocalExit` deliberately suppressed browser-close confirmation for a finished *practice* match even though its result was unconfirmed, and the in-game Leave button silently called discard. Now all device matches with unverified final saves trigger the beforeunload protection, and the finished-match Leave button asks explicit permission before abandoning the unconfirmed result.
- Successful finished results still exit/save normally; actively playing games still use their original discard dialog, and server/PvP flows remain unchanged. New pure-behavior test covers unverified/verified finished results, active games and non-device rooms. **611/611 playable-core**, **65/65 syntax**, **2 complete simulated AI games (85 actions, 2 restores)** passed. Actual React/Node24/mobile remains unverified.
- No engine rules, card/AI tuning, game save format or AI checkpoint edits.

## 2026-11-23 — v0.273.0 query-safe offline PWA asset routing candidate
- A valid game URL with a share/install query string (such as `/?source=homescreen` or `index.html?from=friend`) was absent from the service worker's exact asset URL Map, so an otherwise installed offline game could unexpectedly miss its precached entry and attempt network. Normalize the query/hash of SAME-SCOPE requests before matching **only** the listed immutable asset paths; unknown paths/other scopes are never intercepted.
- The PWA install/rollback VM now verifies offline query-bearing root/index navigation, immutable `game.js?build=...` hash and unknown-asset refusal. **18/18 PWA**, **610/610 playable-core**, **65/65 syntax**, verified approved data checksums. No full Node24/browser game build/device tests; shell is verified using unmodified prior v0.197 game bytes.
- Existing game records, AI checkpoints and 382 collectible card stats unchanged.

## 2026-11-23 — v0.272.0 installed-app fullscreen semantics candidate
- Once launched from the Android/iOS Home Screen, the PWA is already an address-bar-free app window. The existing rotation control tried Fullscreen API again, which Safari may refuse, then incorrectly reported fullscreen failure despite a perfectly immersive PWA. Installed standalone/fullscreen display modes (including iOS `navigator.standalone`) now count as already immersive for the orientation-lock request, without skipping the separate orientation attempt.
- Hide redundant browser fullscreen button only for display-mode standalone, preserving it in normal browser tabs and keeping the portrait rotate/lock action. One new runtime capability test covers installed Android, iOS, browser tab, and fullscreen; static CSS source assertion guards HUD layout. **610/610 playable-core**, **65/65 frontend syntax**, functional AI games 2/2 (85 moves, 2 recoveries) and unmodified baseline data verified.
- Physical Android/iOS display-mode, browser rendering, and Node24 production build unverified; stable binary remains v0.197. No AI strength, card stats, save schema changes.

## 2026-11-23 — v0.271.0 early JavaScript startup crash notice candidate
- A downloaded `game.js` could throw during module evaluation before React rendered; resource-load errors do not catch this. The PWA shell now recognizes an early runtime error reported from `game.js` and shows an immediate Korean retry/backup warning without exposing error messages or deleting IndexedDB saves. Errors after React has mounted, unrelated scripts, and normal slow startups are not marked as fatal.
- Three new VM cases guard early game exception, later nonfatal exceptions and unrelated extensions. The tested installer `index.html` is 5,576 bytes (still separate from multi-megabyte art/game assets); documented its 6 KB bound. Initially new tests found a VM helper event-shape mismatch and an escaped regex in embedded template; corrected both, reran **609/609 playable-core, 18/18 full PWA install/update/rollback, 65/65 TS syntax**. No latest Node24 browser build or physical device verification; verified v0.197 gameplay kept untouched.
- No card stats, AI training/25-stage calibration, gameplay rules, or save schema changes.

## 2026-11-23 — v0.270.0 frontend TS/TSX syntax preflight candidate
- Added `npm run check:frontend-syntax`, a fast and explicit **syntax-only** TypeScript parser for 65 game UI `.ts/.tsx` files. It detects malformed JSX/TypeScript despite the sandbox lacking React/Vite and Node24; does NOT claim semantic typecheck, production compilation or real browser rendering.
- The Node24 GitHub validation workflow runs this new preflight *before* the actual `npm run typecheck` and full browser build. One dependency-free static test enforces truthful output and keeps the `test:playable-core` command independent of TypeScript runtime.
- The global TypeScript 5.8.3 parser available in this sandbox parsed 65/65 frontend sources without syntax errors. Full Node24/React test remains blocked by missing dependencies. No card stats, gameplay balance, AI training/performance, or save schema changes.

## 2026-11-23 — v0.269.0 suspended PWA lifecycle candidate
- Mobile browsers can send an already-loaded PWA into a hidden or locked state during the 15-second startup grace timer. Backgrounded React is not obliged to mount. The watchdog now waits for visibility and gives a **new 15-second visible grace period** rather than falsely showing a startup failure while the user was away.
- Focus/online events while hidden no longer initiate service-worker patch downloads; returning visible uses the established one-minute dedupe throttle and never reloads an active game. Two VM lifecycle regressions cover these cases, along with the existing no-hard-error/late-render suite.
- Isolated PWA shell (unchanged verified v0.197 gameplay) passed 18/18 upgrade, rollback and cache tests. Current v0.269 game build not performed; no AI performance or save/schema changes.

## 2026-11-23 — v0.268.0 mid-size landscape compact hand and readable preview candidate
- Corrected a secondary issue in the v0.266 screen-gap fix: in medium landscape 661–940px wide / 541–760px high, the newly constrained battlefield could clip a selected hand card and the previous hover-disabled UI gave no large inline preview. The hand now displays ten compact cost/art card heads; selection, unplayable-card peek and keyboard focus expand a readable card above the dock; attacking/dragging collapses that preview to avoid interfering with drop targeting.
- Extend the existing measured left/right safe-area preview-shift logic to this exact medium landscape interval; responsive CSS still keeps the entire game shell fixed, while the right rail and auxiliary logs retain only their nested scroll. Pure CSS AST parse succeeds and new focus/preview layout regression passes. Core 603/603; no physical mobile/browser render test yet.
- Original rules, cards, 25-level AI policy/checkpoints and game saves unchanged. Latest built gameplay remains v0.197 until Node24 browser build is available.

## 2026-11-23 — v0.267.0 PWA notch-safe viewport candidate
- The previously verified standalone v0.197 HTML has `<meta name="viewport" content="width=device-width,initial-scale=1"/>`, while its landscape shell already budgets `env(safe-area-inset-*)`. The installable shell did not use `viewport-fit=cover`, so a notched mobile PWA could show unused bars instead of safe-area-aligned content.
- The **installable generated index only** now opts into `viewport-fit=cover` while preserving the independent single-file v0.197 HTML byte-for-byte. A packaging regression checks exactly one viewport-fit directive; updated PWA integrity, upgrade and rollback tests pass 18/18. Actual device notch rendering, iPhone fullscreen policy, and latest v0.267 game build remain unverified.
- No balance or AI 25-rank work, no saved data changes.

## 2026-11-23 — v0.266.0 medium landscape battlefield gap candidate
- The landscape responsive rules missed **661–940 CSS px width / 541–760 CSS px height**: neither the short-phone (<=540px high) grid nor the compact-desktop (>=941px wide) rules fit, so a 100dvh page could retain a vertically scrolling fight. Add a dedicated two-column fluid battleground, central opponent/player rows, independent safe scroll in resources and history and a sticky 44px end-turn button; keep the rest of the app/document stationary.
- New source regression for viewport interval, arena grid, 44px action and nested scrolling, plus CSS parser check. Actual browser screenshots/multidevice E2E remain unverified, so this remains a source candidate.
- No changes to engine rules, collectibles, AI training/rank calibration, persistence schema, or previous verified v0.197 compiled HTML.

## 2026-11-23 — v0.265.0 startup-delay recovery candidate
- Diagnosed v0.263 watchdog incorrectly calling an unmounted React root a corrupted `game.js` resource after 15s on low-end phones. Separate *slow startup* from a verified failed resource: show a gentle retry warning, keep local saves, and let an eventual React DOM mount clear the notice via `MutationObserver`.
- Explicit script/style network failures remain hard errors even if a late root appears; service-worker `ready` cannot conceal a genuine blank startup. Five watchdog VM cases plus extra ready-state test cover delayed start, eventual recovery, actual corruption and no false positives.
- Dependency-free core gate 600/600, install/update/rollback VM 18/18 on second isolated run (first encountered intermittent Node22 Response mock `Body has already been read` in one corruption fixture; no product-code failure). Latest v0.265 gameplay not built with Node24; v0.197 previously verified gameplay preserved. No card/AI/save schema changes and no ladder strength tests.

## 2026-11-23 — v0.264.0 mobile PWA resume update polling candidate
- Installed mobile PWAs may resume from background using `visibilitychange` without a window-focus event. The PWA update checker now checks on return to visible, respects the existing 60-second dedupe throttle, and does not run while hidden. It only downloads/checks; it NEVER force-activates a new service worker under an active match.
- Two pure VM tests verify no missed foreground updates, no hidden checks and no duplicate focus/visibility checks. Wrapped updated installer around the unchanged previously verified v0.197 game package and passed 18/18 service-worker/upgrade/rollback tests on Node22.
- This is not a Node24 production build of v0.264 gameplay, and was not tested on physical Android/iPhone. Cards, gameplay/AI/search strength, checkpoint files and save schema remain unchanged.

## 2026-11-23 — v0.263.0 installed PWA blank-screen watchdog candidate
- The PWA HTML now starts a 15-second check after `window.load` and shows a persistent, dismissible recovery warning if `#root` still has no rendered app. Missing `game.js`/`game.css` are still detected immediately by resource error events. A normal/slow React mount before the deadline stays silent.
- The existing startup error flag takes priority over routine service-worker ready notices (v0.262), preventing missing-code failures from being hidden. Added three executable VM regressions. PWA integrity tests 18/18 against v0.197 compiled game and rebuilt v0.263 installer shell, not full latest game.
- No original card/AI/save changes and no 25-rank AI quality tests. Full latest client Node24 build and real phone browser measurements remain pending.

## 2026-11-23 — v0.262.0 PWA error visibility priority candidate
- Regression fixed after v0.259: an installed PWA with failed/missing `game.js` or card-art CSS could receive a later routine `serviceWorker.ready` notice and silently hide the critical asset-corruption warning. A failed resource now takes priority over routine startup success, reopens the banner and cannot be dismissed by the quiet-start branch.
- A rejected ready-state query also reopens the failure warning instead of being silent. Added a fifth VM regression for boot asset failure. Verified 18/18 existing PWA install/rollback scenarios using unchanged **v0.197 game assets** and v0.262 installer script, plus 10/10 targeted UI VM tests.
- This is installer-shell-only verification, NOT a built v0.262 game. No AI training/rank calibration or changes to game rules, 382 collectible cards or persistence format.

## 2026-11-23 — v0.261.0 isolated playable-core gate candidate
- Added `npm run test:playable-core`: deterministic gameplay-engine, offline-save/recovery, mobile input, orientation/PWA and all dependency-free UI/manifest source regressions. It does NOT run the expensive unfinished 25-rank AI performance ladder or require online socket/React runtime dependencies.
- Real local Node22 with `NODE_OPTIONS=--experimental-strip-types` verified **589/589** selected tests without installing network packages; full npm test still has 24 missing-package failures and must only be claimed on Node24/CI once dependencies are restored.
- CI Node24 workflow now performs this independent gate before `npm test`, full browser build, offline PWA integrity checks and artifact generation. Two gate configuration tests added, so the next candidate will have 591 regression assertions in the core gate. No gameplay rules/card stats/AI champion/authoritative save records changed.

## 2026-11-23 — v0.260.0 offline boot failure recovery candidate
- Before React mounts, the offline/PWA entrypoint now catches invalid or corrupted embedded catalog bootstrap and draws a visible Korean recovery panel with an explicit reload button. The notice states that local match/deck records have not been cleared; the retry does not mutate any storage.
- Error content is constructed with DOM nodes rather than untrusted HTML, so failures cannot inject markup. Added 2 executable/entrypoint regressions to npm test. These check the failure path only; successful React render still needs full Node24 build/browser validation.
- Existing v0.197 standalone and offline assets remain unchanged. All original cards, AI checkpoints, saved-game schema and gameplay rules preserved.

## 2026-11-23 — v0.259.0 installed PWA unobstructed startup candidate
- An already-installed standalone PWA no longer displays a large floating success/status toast over the game on every normal launch. A waiting patch, install failure or integrity failure still reopens the warning. Browser tab keeps its manual Home Screen install guidance.
- Fixed an asynchronous registration race: a worker actively installing (or redundant after failure) cannot be reported as a completed offline cache because serviceWorker.ready resolved.
- Four executable VM scenarios added for installed vs tab, waiting update and installing race; existing PWA package built using unchanged verified v0.197 game art/code but updated shell and passed 18/18 upgrade/rollback checks against the verified v0.197 package on Node22. This verifies installer behavior only, not the unbuilt v0.259 game client. Original card/AI/save data unchanged.

## 2026-11-23 — v0.258.0 portrait dialog keyboard isolation candidate
- Portrait rotation guide now traps keyboard Tab/Shift+Tab on its sole landscape/fullscreen request button while it is shown; background header, toolbar, main content and footer are inert on coarse-pointer portrait devices. On rotation back to landscape existing navigation focus restoration remains enabled.
- Two new source regressions added to npm test and checked TSX syntax without type-checking. No gameplay/AI/card data modifications. Full Node24 build and physical iOS/Android keyboard/rotation test pending; v0.197 remains the last verified executable.

2026-11-23 v0.244~v0.245 개발 후보: 공개 비활성 하수인 상세 보기에서 keyboard/touch 접근성 안내, 안전한 배경 닫기, 가로형 35px 행동 패널이 44px 버튼을 자르는 레이아웃 결함 해소(패널 내 독립 스크롤). UI 테스트 47/47. 데이터/AI/엔진/저장 형식 불변, Node24 빌드 및 기기 시험 미실행.

2026-11-23 v0.242~v0.243 개발 후보: 360px 이하 가로 전장의 턴 종료 항상 접근 가능한 독립 우측 레일, 비활성 공개 하수인 탭으로 키보드/터치 친화적인 상세 패널 열기. 가로형 45/45, 게임 엔진 371/371, 클라이언트 82/82 통과. 전체 React 빌드/실기 미검증, 데이터/AI 원본 불변, 실행판은 이전 v0.197.

## 2026-11-23 — v0.234.0 전체화면 버튼 상태 동기화 후보 (정식 배포 전)
- UI 전환 중 휴대폰 브라우저의 실제 전체화면 진입 상태를 `fullscreenchange`로 감지한다. 전체화면 진입 후 버튼을 '전체화면 종료'로 바꾸고 다시 누르면 실제 `exitFullscreen()` 호출. 브라우저 Esc/뒤로 전체화면 해제도 UI 갱신.
- 세로 화면 안내의 직접 클릭은 기존 요청/수동 회전 폴백을 보존. 접근성 `aria-pressed`, 버튼명 함께 동기화. useState 초기화에서 SSR `document` 즉시 접근 없음.
- TSX 구문 오류 0개, 가로형/접근성 관련 검사 53/53 통과. 엔진/저장/AI 변경 없음. 전체 Vite 빌드 및 실제 휴대폰 fullscreen/rotation은 Node24/의존성 및 브라우저 환경 제약으로 미검증.
- 최신 완전 검증 실행본은 v0.197, 이 버전은 소스 후보.

## 2026-11-23 — v0.233.0 추가 반응형 개선 후보 (정식 배포 전)
- 10장 손패가 좁은 가로폰이나 노치가 큰 휴대폰에서 오른쪽 끝 카드가 숨는 문제 개선. 안전 영역 좌우 `env()`, 자원 레일 폭, 카드 사이 여유를 뺀 실제 가용 가로폭 / 10으로 카드 축소 너비를 계산하고 선택 시 카드는 크게 확대한다.
- 손패 비용 배지도 축소 카드 너비보다 커져 겹치지 않게 제한. 하수인 7개 목표 버튼 너비는 44px 하한 유지하고 필요한 경우 해당 줄에서 가로 스크롤.
- 신규 노치/10장 폭 계산 회귀 검사: CSS/UI 관련 50/50 통과. JS 게임 규칙/저장·AI 원본 불변. Node24 전체 번들/실기 UI 미검증; 이전 v0.197 실행 HTML 유지.

## 2026-11-23 — v0.232.0 반응형 가로 UI 후보 (Node24 전체 빌드 전)
- 사용자 의견 반영: 고정 픽셀 기준 전장이 아니라 실제 가로 화면의 가용 폭과 높이를 사용하는 반응형 게임 UI. `100dvh`, `dvw/dvh`, `clamp()`, 최소/최대 대신 `minmax(0,1fr)`를 조합함.
- 기존 318px 전장 최소 높이와 고정된 54px/51px 영웅·손패 행 제거. 작은 화면에서 메인 메뉴/대상 탐색과 7장 하수인 칸을 비율에 맞춰 재배분. 540px는 *높이 고정값이 아니라 컴팩트 레이아웃 전환 조건*일 뿐임.
- 기존 661px 이하 가로폰에서 전체화면 게임 셸이 빠지는 문제 수정: 가로 방향이면 셸 사용, 짧은 가로 화면의 터치 전장은 별도 조건. 하수인 터치 영역 최소 가로폭 44 CSS px, 필요시 하수인 줄만 가로 스크롤.
- 노치/홈 인디케이터 안전영역 `env(safe-area-inset-*)`, 두 진입 HTML 모두 `viewport-fit=cover` 적용. 650px 이하 가로폰은 저장 슬롯 1열, 세 개 메뉴 버튼은 화면 너비에 맞게 분할, 중요한 터치 버튼 최소 높이 44px.
- 손패 기본 크기와 선택 시 확대 카드도 뷰포트 상대 크기로 변경; 최대 7개 하수인 칸의 행이 나머지 가용 높이를 균등 분배하도록 조정.
- `test/landscape-responsive.test.mjs` 4개 신규 검사. 가로 UI/접근성 검사 49/49, 게임 엔진 371/371, 대표 클라이언트 47/47 (Node22 `NODE_OPTIONS=--experimental-strip-types`); CSS 파서 오류 0, Git whitespace 검사 통과.
- Node24/react/vite 의존성 설치 불가로 전체 Vite/TypeScript/렌더/PWA 업그레이드와 물리 기기 브라우저의 실제 화질·터치/안전영역 검증은 미완료. **v0.197는 최종 완전 검증 실행판**; v0.232는 소스 후보.
- 원본 데이터/382 카드/AI 학습 체크포인트·게임 엔진/저장 스키마 변경 없음.
- 후속: Node24 환경 전체 검증, 소형·중형 가로폰 및 노치·폴더블 실기 검사, 540px 이상 높이 장치의 레이아웃 대비 개선.

## 2026-11-23 — v0.231.0 가로형 게임 로비 개발 후보 (정식 배포 아님)
- v0.229 기반. `play` 화면을 `play-hub` 2열로 재구성: 왼쪽 저장 슬롯/진행상황/이어하기, 오른쪽 직업 및 대전 준비. 각각 독립 스크롤하며 전체 화면과 메뉴는 고정. `decks`/`catalog` 메뉴 클릭 시 플레이 허브를 교체한다.
- 넓고 낮은 휴대폰(가로 CSS 너비 941px 이상, 높이 540px 이하)에서 기존 `classic-table.css`의 절대 배치가 새 중앙 전장/오른쪽 자원 레일을 덮는 문제를 방지: 필드를 상대/내 영웅 중앙 그리드로 다시 배치, 턴 종료/마나/덱 갯수를 오른쪽 열 내부 상대 좌표로 리셋.
- 테스트 Node22 `NODE_OPTIONS=--experimental-strip-types`: CSS, 메뉴 구조, 키보드 및 reduced-motion 포함 42/42; 변경 TSX/TS 6개 구문 검사, tinycss2 파서 오류0, git diff --check 통과. 이전 게임 엔진 371/371, 조작/저장 55/55 회귀도 통과 (v0.229에서 확인, 엔진·규칙·저장 변경 없음).
- Node24/React/Vite/npm 의존성을 다운받을 수 없어 전체 컴파일/렌더/PWA 업그레이드 및 실기 터치 E2E는 여전히 미검증. v0.197 오프라인 실행 HTML 유지. 이 릴리스는 소스 후보.
- 카드382종, 원본 AI/학습 자료, 서버 프로토콜 및 게임 규칙을 변경하지 않음.
- 다음: 전체화면 버튼의 들어가기/나가기 표시 및 접근성, 가로형 창에서 패널 크기 가독성, Node24/의존성 가능한 환경에서 실제 빌드·배포 검증.

## 2026-11-23 — v0.229.0 가로형 웹 게임 화면 개발 후보 (정식 배포 아님)
- 기반 Git v0.226 `6742e0f`와 v0.227 `4a96946`. 모바일 가로 전투에는 중앙 상대/내 영웅, 7개 하수인 칸과 40px 축소 손패의 선택 확대가 포함됨.
- 메인 메뉴, 덱 편집, 카드 도감에 공통 가로형 `100dvh` 게임 셸을 적용. 긴 문서 자체를 스크롤하는 대신 선택한 화면 내부만 스크롤. 3개 게임 메뉴를 클릭해 전환하고 화면 변경 시 내부 스크롤을 상단으로 초기화.
- 모바일 세로 방향에서는 가로로 돌리라는 전체화면 안내를 표시하고, 지원 브라우저의 직접 클릭에 한해 fullscreen/orientation.lock('landscape') 요청. 불가능하면 수동 회전 안내. 아래 화면/설정 조작은 inert 처리해 키보드·보조기기 오조작 방지.
- 가로 휴대폰 높이가 360px 안팎인 상황에서 기존 테마의 최소 540px 전장 크기 제한을 제거하고 한 화면 안에 맞춰 재배치. 44px 턴 종료 버튼 크기는 유지.
- 카드를 낼 마나가 없더라도 손패 카드를 탭하면 전체 텍스트와 이미지가 확대되고, 같은 카드를 다시 탭하면 닫힘. 독립 미리보기 상태만 바뀌며 게임 행동은 실행하지 않음.
- 테스트: Node22 `NODE_OPTIONS=--experimental-strip-types`로 게임 엔진 371/371, 대표 클라이언트 동작 55/55, CSS/가로 셸 40/40; 변경 TSX/TS 6개 TypeScript transpileModule 구문 검사 통과. git diff --check 통과.
- 미검증: Node24 + npm 의존성 미설치 (registry DNS 접근 차단)로 전체 typecheck, Vite 컴파일, PWA 업데이트/롤백 및 실제 모바일/PC 조작 불가. 기존 v0.197 완전 검증 HTML은 반드시 보존. 본 코드는 개발 후보이고 새 실행 HTML은 미생성.
- 카드 382종, AI 체크포인트·학습 원본, 게임 엔진 규칙·저장 스키마 모두 수정하지 않음.
- 후속: 로비에서 전투 입장까지 한 화면에 적합하도록 게임 허브를 2열로 재배치, 카드와 대상 버튼의 사용성 점검, 전체 빌드 가능한 환경에서 재검증.

- v0.226.0 후보: 대상 선택 요약에 출처/개수 접근성 레이블과 페이지 키 안내. 전체 빌드 미검증.
- v0.225.0 후보: 긴 대상 선택 목록 PageUp/PageDown 탐색 및 집중 회귀 테스트. Node24 전체 검증 미완료.
2026-11-23 13:56 KST candidate v0.224 — omit high-DPR canvas allocation and requestAnimationFrame for ordinary turn/choice cues without public events, retain scheduled impact audio and any actual public effects; pure tests 3/3 and TS parser pass. No game-rule/card/save changes. Native Node24 build pending.

2026-11-23 13:54 KST candidate v0.223 — offscreen accepted-combat markers name allied/enemy side and count, remain fully inside short phone canvas without revealing hidden card identities; pure focused tests 2/2, TS syntax okay. Game data/engine/save schemas unchanged. Node24 build pending.

2026-11-23 13:53 KST candidate v0.222 — conflicting deck-backup rename now preserves complete surrogate pairs (emoji) at 40-char boundary, never creates broken name; original saved deck untouched. Focused storage tests 21/21 pass. All existing save schemas/card/AI data unchanged; full Node24 build pending.

2026-11-23 13:52 KST candidate v0.221 — refinement of inert FX ghosts: SVG gradient/clip/mask ids are now uniquely namespaced and their internal URL/href/ARIA references rewritten instead of deleting ids, preserving animated art. Dedicated pure 3/3 regression tests. Node24 full build pending, data unchanged.

2026-11-23 13:49 KST candidate v0.220 — shared canvas particle painter saves/restores once for fire, shadow, steel and other unrotated types instead of per particle; nature retains per-leaf transforms. Deterministic positions verified 2/2 standalone tests; no card/engine changes. Native Vite/browser build pending Node24.

2026-11-23 13:48 KST candidate v0.219 — effect-choice dialog Escape now calls cancelCardChoice, restoring original hand-card focus rather than the generic window reset. Keyboard focus/CSS 6/6. Full Node24/browser build pending. Card/AI unchanged.

2026-11-23 13:47 KST candidate v0.218 — animated attack/death ghost snapshots made inert and aria-hidden; remove cloned nested duplicate IDs, faux target/action identifiers and tab stops. Two focused pure tests pass. Source-only candidate, Node24/browser build unavailable. Original card/AI/save rules untouched.

2026-11-23 13:45 candidate v0.217 — extended real mobile Playwright scenario for emote Escape, sticky close, landscape control geometry; syntax valid, browser not executable in sandbox.

2026-11-23 13:43 candidate v0.216 — mobile emote menu fixed to safe viewport with sticky 44px Close, nested Escape no longer cancels battle source; 23/23 focused CSS/DOM checks and TSX syntax.

2026-11-23 13:40 candidate v0.215 — landscape card detail header names own selected card and wraps text; 22/22 CSS/static tests, TSX parse okay.

2026-11-23 13:38 candidate v0.214 — landscape coarse-pointer actions guaranteed >=44px CSS, tested final stylesheet cascade and narrow-board static checks 21/21.

2026-11-23 13:37 candidate v0.213 — deck editor now alerts on unavailable/corrupt storage at entry, with accessible status message; 20/20 static checks.

2026-11-23 13:35 candidate v0.212 — clear stale deck-library storage warning on recovery without changing valid selection, preserve current user messages; 7/7 focused sync tests and syntax pass.

2026-11-23 13:32 candidate v0.211 — direct saved deck entry shows corruption warning; successful refresh clears stale warning; focused 39/39.

2026-11-23 13:31 candidate v0.210 — saved deck library screen now warns on unreadable/corrupt store instead of silently showing a stale list as valid; 43/43 focused tests.

2026-11-23 13:28 candidate v0.209 — mobile target menu typography increased 14/12/11px and retains scroll, static test passed.

2026-11-23 13:27 candidate v0.208 — independent public combat-status chips in legal target menu, screen-reader text remains single full description; CSS static 17/17.

2026-11-23 13:26 candidate v0.207 — pause live announcements during high-frequency pointer drag; resume after drag; no game rule changes.

2026-11-23 13:25 candidate v0.206 — identifies selected action source in scrollable target picker, accessible close name unchanged; focused tests 35/35.

2026-11-23 13:22 candidate v0.205 — added conservative source+AI+verified-old-playable packager, refuses altered card data and dirty worktree; full Node24 build pending.

2026-11-23 13:20 KST candidate v0.204 — target picker displays public taunt/divineShield/immune/frozen status only; 34/34 focused tests; browser/full build not run (Node22+no dependencies).



## v0.203.0 개발 후보 — 2026-11-23 13:19 KST (정식 배포 아님)

앞서 구현한 모바일 대상 목록의 열기/닫기, 키보드 화살표·Home/End, 목록의 sticky 닫기 버튼, 첫 Escape 시 행동 유지 및 실제 대상 확정 후 사용을 검사하는 Playwright 실기 E2E 시나리오 확장. 짧은 패널 높이를 강제해 스크롤이 있는 경우 닫기 버튼 좌표 확인, 카드/영웅 능력 선택 보존 확인을 추가. `docs/SOLO-ACCEPTANCE.md`에 v198~v203 단계별 모바일/저장 데이터 보호 실기 확인 절차 기록. TypeScript 구문 파싱 0 오류. 실제 브라우저 실행은 환경 Chromium socket EPERM, 의존성 미설치로 불가하므로 E2E **미실행** 명시. 기존 카드·AI/저장 변경 없음, v0.197 검증 실행판 보존. 매시간 자동 실행 OFF.


## v0.202.0 개발 후보 — 2026-11-23 13:18 KST (정식 배포 아님)

별도 '덱 리스트' 화면도 화면 전환·덱 삭제 오류 시 느슨한 `readDecks()` 반환값으로 기존 목록을 빈 배열로 덮어쓸 수 있음을 발견해 v0.200의 엄격한 검증/마지막 확인 목록 유지 로직을 공통 사용하도록 통합. 정상적인 다른 탭의 저장 변경은 반영, 손상/접근 불가 데이터는 화면 내 유효한 덱을 임의 삭제한 듯 표시하지 않음. 덱 소스·정적 UI 검증 추가, 저장/동기화/모바일 37/37 통과. 실행판/전수/실기 검증 및 새 HTML 배포 미실행; 카드/AI/저장 스키마 원본 보존. 자동 예약 OFF.


## v0.201.0 개발 후보 — 2026-11-23 13:18 KST (정식 배포 아님)

합법 대상 10개 이상인 좁은 폰/가로화면에서 목록을 아래로 스크롤하면 최상단 '대상 목록 닫기' 버튼이 사라지던 문제 완화. CSS 그리드 목록의 닫기 버튼을 sticky 상단으로 유지하고 키보드로 이동한 대상의 초점 테두리가 닫기 버튼 밑에 가려지지 않도록 스크롤 여백 추가. 정적 모바일/CSS·대비·키보드·동작 줄이기 22/22 통과. 실제 모바일 스크롤 위치와 포커스 가시성은 환경 제약으로 미검증. 엔진·저장·카드/AI 불변, v0.197 마지막 전체 검증판 유지, 자동 진행 OFF.


## v0.200.0 개발 후보 — 2026-11-23 13:14 KST (정식 배포 아님)

덱 편집기에서 명명된 덱 저장/삭제 실패 시 `readDecks()`의 느슨한 오류 처리로 기존 화면의 유효한 저장 덱 목록이 빈 목록으로 바뀌던 문제 수정. 실패 후 저장소를 엄격히 재검증하고 실제로 유효한 외부 변경일 때만 갱신, 저장소 접근 거부/손상 시 마지막 확인된 목록을 유지하며 현재 선택 인덱스를 해제. 원본 저장 데이터·스키마 변경 없음. 저장 오류/외부 추가/삭제/변경 없음의 회귀 1개 추가, Node22 순수 저장/다중 탭/모바일 정적검사 35/35 통과. Node24 및 React/Vite 의존성 부재로 전체·타입·웹빌드/실기 미검증, v0.197 마지막 완전 검증판 보존. 자동 실행 OFF.


## v0.199.0 개발 후보 — 2026-11-23 13:12 KST (정식 배포 아님)

모바일/키보드 대상 목록이 확장된 상태에서 화살표·Home·End로 오직 공개된 합법 대상 버튼의 포커스를 순환/이동하도록 개선. Enter/Space를 통한 명시적 선택 전에는 전투 명령을 보내지 않으며, Shift/Alt/Ctrl/Meta와 목록을 닫은 상태는 탐색 대상에서 제외. 기존 Esc 두 단계/선택 취소/모바일 목록 닫기 유지. 기존 키보드 탐색 모델 재사용, 앱 CSS 및 정적 회귀 1개 추가. Node22 실험적 TS 제거로 엔진/조작/저장 관련 453/453과 정적 모바일 검사 통과, TSX 구문 파싱 0 오류. Node24/React/Vite 의존성 부재로 전체 회귀·타입검사·오프라인 빌드/업데이트/실기 미실행. 마지막 전체 검증판 v0.197 유지. 카드·AI/저장 포맷 변경 없음. 매시간 자동 진행 OFF.

- **v0.129.0 미검증 후보 (2026-11-23 03:58 KST):** 키보드로 접근하는 커스텀 role=button/option 요소의 focus-visible 테두리를 공통 스타일에 추가. 신규 정적 회귀 1/1 및 v0.128 덱 분포 단위 3/3 통과(Node22 실험적 TS 제거). 전체 테스트/타입검사/웹 빌드는 Node24·npm 의존성 부재로 미실행. v0.126 마지막 전체 검증 버전 유지. 카드/AI/저장 포맷 변경 없음.

# Development progress

## v0.198.0 candidate — 2026-11-23 13:01 KST
- Mobile touch/narrow target picker anchored to safe viewport bottom; max-height and independent scroll prevent clipped targets. Add 44px close action that restores summary focus without cancelling a selected card; first Escape from expanded picker collapses only the picker, second Escape cancels action. Desktop popover preserved. Two CSS/source targeted regressions and Escape check added (mobile scroll CSS suite now 10/10). No game engine, card, AI or save schema edits.
- Available verification: Node22 native TS stripping engine 371/371, pure client tests 74/74, CSS/accessibility static tests 15/15 and TypeScript transpile parse 2 files with 0 diagnostics. Attempted `tsc --noEmit`: blocked by missing modules/@types. Attempted offline `npm ci`: ENOTCACHED for xmlhttprequest-ssl with Node22 engine mismatch. Full 725+ suite, render, build, PWA and actual device browser NOT run. Preserve v0.197 as latest fully verified release; only a source candidate is archived. Hourly automation remains disabled.

## v0.197.0 verified — 2026-11-23 12:52 KST
- Fixed a real test-fixture defect in epic-heavy stress decks: filler unintentionally included duplicate-copy legendary cards. Use only non-legendary filler, honor max copies, and trim to legal 30-card decks. Add CLI regression covering all 81 ordered hero-class pairings and 38/38 epic coverage; focused1/1. Separately verified 81 random and 81 legendary simulated games; AI225/225 completed with 13,484 legal actions, Android7/7 and experimental difficulty3/3. Full725/725, type, render61/61, prior v196 PWA upgrade/rollback18/18, standalone HTML2/2, build, local preflight passed. No real-device E2E; actual game card rules and AI unchanged.

## v0.196.0 verified — 2026-11-23 12:50 KST
- Close missed cross-tab deck change window: check on first subscription and when local deck write/restore completes or saved-deck screen becomes active. Keep hidden/busy guards; two new fake-tab tests prove missed initial event and deferred event catch-up. Focused5/5, full724/724, type, render61/61, real v195 PWA upgrade/rollback18/18, standalone HTML2/2, build and local preflight pass. No real-device E2E; storage engine/card/AI untouched.

## v0.195.0 verified — 2026-11-23 12:45 KST
- Extract cross-tab named-deck sync into testable visibility/storage/focus observer. Three deterministic tests cover changed/unchanged keys, hidden/active-edit deferrals, malformed external data, and full listener teardown. Focused3/3, full722/722, typecheck, render61/61, real prior v194 PWA upgrade/rollback18/18, standalone HTML2/2, build and local deployment preflight passed. No physical browser verification; engine/card/AI/save schema unchanged.

## v0.194.0 verified — 2026-11-23 12:43 KST
- Release packager will preserve a separately checksum-verified `vNNN-solo-app` snapshot for next-release real upgrade/rollback tests, refusing existing folders and never overwriting prior artifacts. Memoize fallback slot storage wrapper in deck editor/workspace to prevent repeated focus listener subscriptions. Typecheck, full719/719, render61/61, prior v193 PWA upgrade/rollback18/18, HTML2/2, web/local preflight pass. Packaging run after commit; no real-device E2E or game data changes.

## v0.193.0 verified — 2026-11-23 12:41 KST
- Refresh named-deck lists from strict storage on matching other-tab storage changes, foreground return and focus. Reset stale selected indexes only when content actually changes, skip during local mutations, and never overwrite a valid list with corrupt external bytes. Focused storage18/18, typecheck, full719/719, render61/61, actual v192 PWA upgrade/rollback18/18, HTML2/2, web/local preflight. Real-browser E2E blocked by environment. v192 HEAD-only packager succeeded and refused duplicate output, 225 seeded AI games / 13,484 accepted actions finished. Game engine/cards/AI/save schema untouched.

## v0.192.0 verified — 2026-11-23 12:36 KST
- Add Git HEAD-only release packager that rejects dirty worktrees, existing output, stale/invalid standalone or PWA resources; checks SW SHA-256 and bundles committed source, offline install assets and AI data with incremental Git history. Document safe local packaging. Dirty-tree refusal, typecheck, full718/718, render61/61, real v191 PWA upgrade/rollback18/18, HTML2/2, web/local preflight. First committed packaging pending. No real-browser E2E or game data mutations.

## v0.191.0 verified — 2026-11-23 12:33 KST
- Memoize deck editor class sorting, filtered card sets, and search results, and card-browser class sorting/scoping/search, avoiding repeated work on unrelated UI updates. Label each save-slot button via its specific state, rank/XP and resumable-match details using aria-describedby. New standalone App SSR regression, typecheck, full718/718, render61/61, actual v190 PWA upgrade/rollback18/18, HTML2/2, web/local preflight pass. No real-browser E2E; no engine/card/AI/save schema edits.

## v0.190.0 verified — 2026-11-23 12:31 KST
- Use two save-slot columns at <=360px, wrap long error messages without shrinking recovery buttons, and make mobile lobby/offline patch/storage protection controls >=44px tall. Two new CSS checks (7/7 total), install-package CSS assertion, typecheck, full718/718, render60/60, prior v189 PWA upgrade/rollback18/18, HTML2/2, web/local preflight. No real-browser E2E, no engine/card/AI/save schema changes.

## v0.189.0 verified — 2026-11-23 12:28 KST
- Separate steady polite reconnect status from visible per-second countdown with aria-live=off, keeping the exact deadline accessible without continuous screen reader announcements. Initialize reconnect time from the provided deadline at first render. New SSR check, typecheck, full716/716, render60/60, actual v188 PWA upgrade/rollback18/18, standalone HTML2/2, web build/local preflight and card audit pass. No real-browser E2E; no engine/card/AI/save mutation.

## v0.188.0 verified — 2026-11-23 12:25 KST
- Developer account panel suspends its 10-second polling interval and cancels in-flight network requests when hidden. Resuming foreground requests fresh status once without stale error overwrites, and unmount removes handlers. Fake-clock/visibility regression3/3, typecheck, full716/716, render59/59, prior v187 PWA upgrade/rollback18/18, standalone HTML2/2, web build/local preflight. Browser E2E unexecuted. Engine/card/AI/save schema untouched.

## v0.187.0 verified — 2026-11-23 12:20 KST
- Enlarge mobile save-slot action, collection pagination, and deck-editor control hit areas to 44px minimum; keep save-slot metadata at 12px on narrow screens. Five CSS regression checks pass (three new). Typecheck, full713/713, render59/59, actual v186 PWA upgrade/rollback18/18, standalone HTML2/2, web build/local preflight pass. Engine/card/AI/save schema unchanged; no real-device E2E.

## v0.186.0 verified — 2026-11-23 12:16 KST
- Stop expired display-only countdown intervals at zero and prevent restarting them from already-expired deadlines, preserving engine-authoritative timing and hidden/visible transition behavior. Clock2/2, prior PWA18/18, typecheck, full710/710, render59/59, HTML2/2, web/local preflight. Browser E2E unexecuted. No engine/card/AI/save-schema edits.

## v0.185.0 verified — 2026-11-23 12:13 KST
- Suspend presentation-only turn/reconnect countdown intervals while hidden, instantly recompute from authoritative deadlines on visibility return, and remove duplicate interval registrations. Clock2/2, typecheck, full710/710, render59/59, previous PWA18/18, HTML2/2, web/local preflight. Browser E2E unexecuted. No engine/AI/card/save-schema changes.

## v0.184.0 verified — 2026-11-23 12:11 KST
- Coalesce duplicate focus events during sequential slot preview workers. Cancel only preview reads while hidden and recheck on visibility restore, preserving fresh updates after prior completion. Recovery8/8 model checks, previous-release PWA18/18, typecheck, full708/708, render59/59, HTML2/2, web/local preflight. Browser E2E unexecuted. No engine/AI/card/save-schema edits.

## v0.183.0 verified — 2026-11-23 12:09 KST
- Explain when a browser lacks secure service workers: game play may still work but offline installation is unavailable. Preserve higher-priority resource failure warning. Real v182 previous-release PWA18/18, typecheck, full707/707, render59/59, HTML2/2, web/local preflight. Browser E2E unexecuted. No engine/AI/card/save-schema changes.

## v0.182.0 verified — 2026-11-23 12:07 KST
- Early installable-page observer reports game CSS, JS and registration load failure and preserves the warning against late service-worker status updates; standalone HTML untouched. Real v181 previous-release PWA17/17, typecheck, full707/707, render59/59, HTML2/2, web/local preflight. Browser E2E blocked by socket EPERM. No engine/AI/card/save-schema changes.

## v0.181.0 verified — 2026-11-23 12:05 KST
- Announce verified install asset counts from the currently installing worker only, including reused verified resources; reject invalid and late messages, and never gate installation on progress reporting. Real v180 previous-release PWA16/16, typecheck, full707/707, render59/59, HTML2/2, web/local preflight. Browser E2E unexecuted. No engine/AI/card/save-schema edits.

## v0.180.0 verified — 2026-11-23 12:03 KST
- Service worker validates cached asset SHA-256 on first fetch in each worker lifetime; a corrupt game JS/CSS/document is removed and repaired only from exact current-release bytes, with offline 503 rather than executing damaged content. Avoid repeated hashing of large art in the same worker. Previous PWA15/15, typecheck, full707/707, render59/59, HTML2/2, web/local preflight. Browser E2E unexecuted. No engine/AI/card/save-schema edits.

## v0.179.0 verified — 2026-11-23 12:01 KST
- Fence stale browser-storage persistence status reads against a more recent user-triggered request, including denied requests; prevent reentry while the control is busy. Real v178 PWA upgrade/rollback14/14, typecheck, full707/707, render59/59, HTML2/2, web/local preflight. Browser E2E unexecuted. No engine/AI/card/save-schema edits.

## v0.178.0 verified — 2026-11-23 12:00 KST
- First-time install now explains cache preparation and failure, even if registration resolves after install started. Late ready cannot mask a waiting patch, and listeners are deduplicated. Previous-release PWA13/13, typecheck, full707/707, render59/59, HTML2/2, web/local preflight. Browser E2E blocked by Chromium socket EPERM. No engine/AI/card/save-schema edits.

## v0.177.0 verified — 2026-11-23 11:59 KST
- Split installable app document from large art CSS and game JS; each asset hash checked and cached for offline installation, legacy 5-file releases remain valid for upgrade/rollback, standalone one-file HTML untouched. Real v176 upgrade/rollback PWA11/11, typecheck, full707/707, render59/59, HTML2/2, web/local preflight. Browser E2E authored, not executed. No card/AI/engine/save-schema changes.

## v0.130.0 후보 (2026-11-23 05시 KST)
- 고대비 모드의 카드 선택/공격 대상 및 키보드 포커스 표시를 시스템 색상으로 개선.
- 신규 Node22 정적 회귀 2/2 통과. npm ci --offline ENOTCACHED(xmlhttprequest-ssl). Node24/전체 테스트/빌드 미검증.
- AI, 카드 밸런스, 로컬 저장 스키마 변경 없음. v0.126 마지막 전체 검증 유지.

## v0.131.0 candidate (2026-11-23 06 KST)
- Classic-table reduced-motion hover/focus no longer translates card; visible focus outline retained. New static checks 3/3 passed on Node22.
- Full suite/build unavailable without Node24/dependencies. v0.126 remains verified baseline. AI/card/save unchanged.

### 2026-11-23 10:01 KST — v0.144 candidate
Summon art theme and explicit death-vs-exit visual separation implemented; two tests authored but unexecuted (Node22, missing React dependencies). Full v0.143 remains verified baseline. See HANDOFF.md.

### 2026-11-23 10:09 KST — v0.144 verified
Restored original Git history, integrated candidate and independent per-minion summon themes/board positions. Node24 typecheck, full regression 674/674, render49/49, real PWA upgrade/rollback9/9 and standalone HTML2/2 passed. Browser launch blocked by socket permission; physical acceptance remains open. No card/AI/engine changes.

### 2026-11-23 10:12 KST — v0.145 verified
Cached deterministic particle geometry and stable impact label layout, bounded late DOM position lookups. Typecheck, full regression 676/676, render49/49, PWA9/9 (actual prior release), standalone HTML2/2 and web build passed. Physical device FPS still unmeasured. No card/AI/engine data edits.

### 2026-11-23 10:16 KST — v0.146 verified
Hidden tab playback fast-forwards latest accepted state, skips stale presentation, stops scheduled WebAudio, captions, speech and haptics; fresh cues resume normally. Typecheck, 677/677, render49/49, PWA9/9, HTML2/2, build and local deployment preflight passed. Real device switching/audio not verified. No card/AI/engine edits.

### 2026-11-23 10:18 KST — v0.147 verified
Ten bounded, offline themed summon sound recipes matched to public card visual themes. Typecheck, 678/678, render49/49, PWA9/9 actual prior release, HTML2/2, build and local deployment preflight passed. Physical listening/audio quality remains unverified; all card/AI/engine data intact.

### 2026-11-23 10:21 KST — v0.148 verified
Cancel transient mouse/touch inputs on blur, hidden tab and pagehide; safely release pointer capture, hide aim/ghost/selection and retain delayed-release guard. Fresh input immediately works after cancellation. Typecheck, 679/679, render49/49, PWA9/9, HTML2/2, build/local preflight passed. New mobile E2E authored but browser socket restriction remains; physical validation open. No card/AI/engine changes.

### 2026-11-23 — v0.149 verified
Separate confirmed deaths from confirmed non-death departures with bounded WebAudio recipes across animation speeds; mixed departures prioritize death, unknowns stay silent. Typecheck, 680/680, render49/49, PWA9/9, HTML2/2, web build/local preflight passed. Physical audio and device validation open. No card/AI/engine changes.

### 2026-11-23 — v0.150 verified
Ignore clipped insertion gaps, reject drops with no visible gap, synchronize pending target/choice minion placement with its visible selected gap and actual command; show insertion number and reset on state revision. Typecheck, 682/682, render49/49, real previous PWA9/9, HTML2/2, build/local preflight passed. Mobile E2E authored, physical validation open. No card/AI/engine changes.

### 2026-11-23 10:37 KST — v0.151 verified
Press the same minion/hero attacker or targeted hero-power source to cancel, switch sources in one press, and expose pressed/target distinctions to assistive technology. Instant powers and legal target priority unchanged. Typecheck, 683/683 on isolated full rerun (two existing timeouts with concurrent builds), render50/50, real previous PWA9/9, HTML2/2, build/local preflight passed. Mobile E2E authored; actual browser/device still unverified. No card/AI/engine changes.

### 2026-11-23 10:45 KST — v0.152 verified
Recovered original history and dependencies. Touch-only nearby target tolerance for attacks/targeted spells, 10px maximum and 4px ambiguity margin; no snapping to illegal or clipped targets, controls, hands or minion placements. Clear visual outline for actual drop target. Typecheck, 684/684, render50/50, previous PWA9/9, HTML2/2, web build/local preflight passed; browser socket restriction prevents real E2E. No card/AI/engine changes.

### 2026-11-23 10:48 KST — v0.153 verified
Arrow-key legal target navigation, Home/End, explicit native Enter/Space activation, keyboard-only focus after card/effect choice and Escape return to source. Typecheck, 685/685, render50/50, real prior PWA9/9, HTML2/2, web build/local preflight. Browser scenario authored but socket permission blocks execution. No card/AI/engine changes.

### 2026-11-23 10:51 KST — v0.154 verified
Optional collapsible large touch target picker for legal targets, public owner/stats and minion position disambiguation; unchanged validated action path, not shown during drag. Typecheck, 686/686, render51/51, real prior PWA9/9, HTML2/2, web/local preflight. Mobile browser scenario authored, actual execution blocked. No card/AI/engine edits.

### 2026-11-23 10:54 KST — v0.155 verified
Actual actionable drop target name, side and position in feedback; same selected card cancels held, choice or targeting state. Hide keyboard hint on coarse/narrow screens. Typecheck, 688/688, render51/51, real prior PWA9/9, HTML2/2, web/local preflight. Physical validation open. No card/AI/engine edits.

### 2026-11-23 10:56 KST — v0.156 verified
Measure genuine horizontal board overflow on revision/resize; only scrollable friendly rows permit native horizontal panning from attacker sources, vertical attack drag unchanged, scrolling never submits. Both overflow rows show a hint. Typecheck, 689/689, render51/51, real prior PWA9/9, HTML2/2, web/local preflight. Browser E2E authored, blocked. No card/AI/engine edits.

### 2026-11-23 10:59 KST — v0.157 verified
Held minion touch drag edge panning after 140ms within 24px of the visible row, bounded by elapsed time and scroll range, refresh visible placement feedback and stop on cancellation/edge/outside/hidden/unmount. Typecheck, 690/690, render51/51, real prior PWA9/9, HTML2/2, web/local preflight. Actual browser unverified. No card/AI/engine edits.

### 2026-11-23 11:06 KST — v0.158 verified
Integrated recovered hourly candidate in the original Git history. Restore native horizontal overflow and safe center alignment on narrow boards; add two CSS regression tests to full suite. Typecheck, 692/692, render51/51, real prior PWA9/9, HTML2/2, web/local preflight. Actual browser unverified. No card/AI/engine edits. Hourly automation disabled at user request; direct development continues.

### 2026-11-23 11:09 KST — v0.159 verified
Exact numbered native insertion-gap picker with neighboring public card names, 44px mobile control, scroll chosen gap into view, preserve pending minion position without auto-playing. Typecheck, 693/693, render52/52, real prior PWA9/9, HTML2/2, web/local preflight. Browser unverified. No card/AI/engine edits.

### 2026-11-23 11:11 KST — v0.160 verified
Retry an owned transient durable-save failure in place, preserving match/revision and fencing stale owners. Repeated retry after recovery does not write. Clear active drags on busy/playback lock even without revision changes. Typecheck, 694/694, render53/53, local32/32, real prior PWA9/9, HTML2/2, web/local preflight. No card/AI/engine/save-schema edits.

### 2026-11-23 11:13 KST — v0.161 verified
Distinguish pending save from durable confirmation, display only the current match's last saved time, request native before-unload warning for unconfirmed local state, use offline-specific failure advice. Typecheck, 695/695, render54/54, session5/5, real prior PWA9/9, HTML2/2, web/local preflight. No card/AI/engine/save-schema changes; browser warning not tested in a real device.

### 2026-11-23 11:16 KST — v0.162 verified
Compact battle toolbar: keep quick mute visible, move detailed audio and voice controls into existing scrollable effects settings with 44px touch actions and Escape focus return. Settings keys preserved. Typecheck, 695/695, render55/55, real prior PWA9/9, HTML2/2, web/local preflight. Updated mobile browser scenario not executed. No card/AI/engine/save-schema edits.

### 2026-11-23 11:19 KST — v0.163 verified
Clip accepted FX anchors to visible board regions, aggregate fully hidden affected units by side and direction, omit misleading clipped actor/departure clones and preserve exact outcomes in history. Scroll-aware summon projections. Typecheck, 697/697, FX41/41, render55/55, real prior PWA9/9, HTML2/2, web/local preflight. Actual device unverified. No card/AI/engine/save-schema changes.

### 2026-11-23 11:21 KST — v0.164 verified
Cancel stale spatial motion on board pan, refresh visible anchors and offscreen marker cache, stop stale-size canvas after real resize while preserving accepted impact timing, sound and haptics. Cleanup scroll/resize listeners and observer. Typecheck, 699/699, FX43/43, render55/55, real prior PWA9/9, HTML2/2, web/local preflight. Actual device unverified. No card/AI/engine/save-schema changes.

### 2026-11-23 11:24 KST — v0.165 verified
Disambiguate identical minions in accepted history using pre-action board slot, or post-action slot for new summons. Report observed attack/max-health changes and public transformation name. Typecheck, 700/700, FX44/44, render55/55, real prior PWA9/9, HTML2/2, web/local preflight. Actual device unverified. No data/engine/save-schema changes.

### 2026-11-23 11:27 KST — v0.166 verified
Keyboard arrows/Home/End navigate inspection rows; keyboard hand activation focuses explicit play confirmation without auto-playing, Escape restores source. Preserve legal target navigation and pointer selection. Typecheck, 700/700, render56/56, real prior PWA9/9, HTML2/2, web/local preflight. Desktop E2E authored, browser unavailable. No data/engine/save-schema changes.

### 2026-11-23 11:30 KST — v0.167 verified
Recover focus when keyboard action completes and interaction becomes available: same legal source, playable hand card, another legal source or end-turn, unless user navigated away. Unified keyboard activation signal while preserving pointer actions. Typecheck, 701/701, actions18/18, render56/56, real prior PWA9/9, HTML2/2, web/local preflight. Updated E2E unexecuted. No data/engine/save-schema changes.

### 2026-11-23 11:34 KST — v0.168 verified
Own card choice dialogs trap focus among enabled controls, mark background inert, restore local cancellation source, retain pause and exit during forced choices; no modal trap for opponent or disconnected waiting. Typecheck, 702/702, actions19/19, render57/57, real prior PWA9/9, HTML2/2, web/local preflight. Actual browser unverified. No data/engine/save-schema changes.

### 2026-11-23 11:37 KST — v0.169 verified
Fatal worker failures trigger durable-save reinspection; preserve known summary on unavailable read, label unconfirmed metadata, disable resume/remove during recheck and retain safe explicit retry. Typecheck, 703/703, recovery6/6, render57/57, real prior PWA9/9, HTML2/2, web/local preflight. Authored worker failure E2E, actual browser unverified. No data/engine/save-schema changes.

### 2026-11-23 11:39 KST — v0.170 verified
Responsive book geometry drives keyboard focus across desk and narrow columns without activation; Home/End and page live status. Typecheck, 704/704, visual model5/5, render58/58, real prior PWA9/9, HTML2/2, web/local preflight. E2E authored, actual browser unverified. No data/engine/save-schema changes.

### 2026-11-23 11:41 KST — v0.171 verified
Immediately dispose scheduled audio graphs on mute, zero volume and match release; cap concurrent sources to 32; avoid silent audio startup. Eliminate unnecessary collection geometry reads on non-navigation keys. Typecheck, 704/704, FX44/44, render58/58, real prior PWA9/9, HTML2/2, web/local preflight. Actual device audio unverified. No data/engine/save-schema changes.

### 2026-11-23 11:43 KST — v0.172 verified
Hold automatic FX pressure briefly across cues (8s), use smaller next canvas and density, recover automatically, preserve manual/reduced preferences. Skip RAF on unavailable canvas and unused departure clones. Typecheck, 705/705, FX45/45, render58/58, real prior PWA9/9, HTML2/2, web/local preflight. Actual device FPS unverified. No data/engine/save-schema changes.

### 2026-11-23 11:45 KST — v0.173 verified
Keep cancelled touch click guards but permit independent trusted non-pointer keyboard/assistive activation without clearing guard; restore effect-choice source on context cancellation. Typecheck, 706/706, hover9/9, render58/58, real prior PWA9/9, HTML2/2, web/local preflight. E2E expanded, actual browser unverified. No data/engine/save-schema changes.

### 2026-11-23 11:48 KST — v0.174 verified
PWA activation deletes only known previously active cache, retains waiting or unknown legacy cache, verifies existing same-release assets for offline reinstall and preserves valid files on failed repair. Typecheck, 706/706, render58/58, PWA11/11 with real v173 upgrade/rollback, HTML2/2, web/local preflight. Actual browser unverified. No data/engine/save-schema changes.

### 2026-11-23 11:51 KST — v0.175 verified
Lock commands after local worker timeouts, distinguish matching acknowledgement from unrelated views, unlock on late success and require explicit informed confirmation before terminating a stalled worker and re-probing last durable save. Typecheck, 707/707, recovery7/7, render58/58, real prior PWA11/11, HTML2/2, web/local preflight. E2E authored, actual browser unverified. No data/engine/save-schema changes.

### 2026-11-23 11:52 KST — v0.176 verified
Coalesce caption expiry timers to the earliest live line, preserve per-line deadline and speech cue ordering, reduce screen-reader removal announcements. Typecheck, 707/707, render59/59, real prior PWA11/11, HTML2/2, web/local preflight. Actual device unverified. No data/engine/save-schema changes.

### 2026-11-23 16:46 KST — v0.235.0 candidate
Landscape hand-card expansion is now clamped to the measured visible field, even for cards at the first and last hand positions, notch/cutout sizes, and very small split screens. Resize and focus changes trigger reposition; moving only the expanded visual avoids changing card hit regions, board layout, game state, or drag geometry. Added tested pure geometry helper and subscribed its checks to npm test. Landscape tests 25/25; engine 371/371 on Node22 with TS strip; TS syntax check passed. Full Node24 build and device E2E not yet available. Original card/AI/save data untouched.

### 2026-11-23 16:48 KST — v0.236.0 candidate
Inactive/unplayable hand-card inspection now closes with Escape even during the opponent turn, and tapping the battlefield closes that preview without intercepting the battlefield action. Selected playable hand cards accurately expose expanded state to assistive technology; mulligan semantics stay unchanged. Updated existing and three new source regression tests. All landscape tests 28/28; TS syntax parsed, inherited engine 371/371. Full Node24/browser verification remains open, card/AI/save schema unchanged.

### 2026-11-23 16:52 KST — v0.237.0 candidate
Made every narrow (<=660 CSS px) landscape touch control at least 44px tall, covering combat action bar, save/leave settings, turn end/concede, and card detail entry. Overflow is isolated to the action/toolbar strips rather than the full document. Source checks 30/30; engine unchanged. Physical device/browser checks and Node24 build still pending. No card balance, AI model, or save schema changes.

### 2026-11-23 16:55 KST — v0.238.0 candidate
Browser fullscreen and landscape-orientation requests now degrade independently: fullscreen rejection does not stop the orientation attempt, and a failed orientation lock does not invalidate successful fullscreen. Concurrent rotate/fullscreen requests are gated, the currently active state is still synchronized with native fullscreenchange, and locks acquired by the game are released on fullscreen exit or component unmount. Added four pure/mock and source regression tests; entire landscape suite 34/34 (Node22 --experimental-strip-types). Native Node24 web build/physical device remain unverified. No game rule, saved-match format, AI, or card data changed.

### 2026-11-23 16:58 KST — v0.239.0 candidate
Keyboard/assistive focus movement through the collapsed hand now dismisses a different unplayable card's enlarged peek; moving outside the hand also dismisses it. This avoids simultaneous overlapping previews while allowing a same-card focus transition to preserve inspection. Added pure helper and focused tests; landscape suite 35/35. TS syntax checks pass; real browser/Node24 build still pending. Card/AI/save data untouched.

### 2026-11-23 17:00 KST — v0.240.0 candidate
On a short landscape phone, a selected card used to remain enlarged behind the drag ghost, potentially covering a legal drop slot and misdirecting releases. The dock visual now returns to its compact size for any active drag while preserving the source button/pointer capture and a separate drag ghost. Added two regression checks; landscape suite 37/37, client pure logic 82/82 previously checked. Native full build and physical drag E2E remain unverified. Original card, AI, rule and save data unchanged.

### 2026-11-23 17:03 KST — v0.241.0 candidate
Added a repeatable source-only packaging command for development checkpoints. A prior candidate ZIP (v0.236) accidentally omitted 13 gitignored `data/ai` checkpoints; the new packager explicitly includes these, verifies every model file SHA-256 from the archive, includes the prior verified executable with prominent candidate-vs-playable labeling, and rejects uncommitted Git or a mismatched binary version. Source tests 3/3; packed archive and bundle need execution verification after the commit. Original game/card/AI models not modified.

### 2026-11-23 — v0.246.0 mulligan candidate
Short landscape mulligan now fits dynamic viewport, card list scrolls internally and confirm stays at least 44px. Landscape tests 46/46, engine 371/371. Node24/web build and physical phone unverified; original cards/AI/saves unchanged.

### 2026-11-23 — v0.247.0 PWA manifest candidate
Installable app requests landscape and standalone mode at launch, with Apple install metadata and fallback preservation. Pure manifest-source tests added. Full Node24 build and actual install orientation remain unverified.

### 2026-11-23 — v0.248.0 installer shell fix
Prevent banner from adding a document row in a 100dvh installed game; safe fixed toast with dismiss. Test-only isolated installer builds and immutable CacheStorage mock. 18/18 full PWA install/upgrade/rollback checks on verified v0.197 game assets with new installer shell. No v0.248 client binary produced; full Node24 production build/device E2E pending. Cards/AI/save-schema unchanged.

### 2026-11-23 — v0.249.0 Node24 CI playtest packaging
Added manual GitHub Actions candidate pipeline and strict CI-only version stamping; 3 tests. No workflow run yet and no external GitHub push. Physical Android/iOS device test remains pending. Original executable stable v0.197 unchanged.

### 2026-11-23 — v0.250.0 landscape deck/catalog workspace candidate
Refactored deck editor/catalog toolbars to scroll separately from card-grid and live deck/sidebar. Game document locked to landscape viewport, 44px coarse touch controls; new source regressions. Existing v0.197 binary left unchanged. Full Node24 client build/physical devices still unverified. Original game data and AI preserved.

### 2026-11-23 — v0.251.0 mobile tap accessibility candidate
Resolved 28px header/36px save slot short-landscape tap target regression, preserving >=44px on coarse-pointer phones, and locked the underlying portrait page beneath rotate overlay. Two regression tests, no game rules/cards/AI/save schema changes. Physical UI and Node24 build pending.

### 2026-11-23 — v0.252.0 PWA install affordance candidate
Added native browser install button with beforeinstallprompt and explicit click plus manual Safari/other browser install instructions. Installed standalone suppresses install UI. Source VM tests + isolated stable-build PWA compatibility tests; real mobile installation not tested.

### 2026-11-23 — v0.253.0 frozen release data guard candidate
Added content-hash release safety gate (active cards, progression, 2 released AI champions), separate documented immutable baseline and GitHub CI step, with tampering tests. No data edits.

### 2026-11-23 — v0.254.0 mid-height landscape tablet battlefield candidate
Removed the classic 540px minimum conflict for 941px+ landscape viewports 541–760px tall. The arena flexes inside remaining screen height; 44px controls preserved. CSS regressions only; physical tablet/Chrome validation pending.

### 2026-11-23 — v0.255.0 result-screen keyboard focus candidate
Result overlay is an accessible modal with initial result-action focus and Tab-cycle trap. Uses already-tested modal tab selection, no game logic change.

### 2026-11-23 — v0.256.0 compact choice/result overlay candidate
Cards in decision modals use horizontal panning on compact landscape screens, modal heights constrained, min 44px buttons. No changes to game state/AI/data.

2026-11-23 17:58 KST — candidate v0.257: added bounded real-engine solo end-to-end CI gate (2 full ranked AI games, 85 game actions, 2 mid-match saves/restores, progression/backup validated). Exhaustive 25-tier diagnostic timed out at tier 23 and is NOT complete. Await Node24/Vite production build and real-device testing.

### 2026-11-23 20:xx KST — v0.286 candidate (source-only)
- Installed PWA now hides redundant browser-fullscreen toggle; independent portrait rotation guide remains accessible. Displays resync on standalone/fullscreen media changes and window focus, with cleanup.
- Dedicated 2/2 static tests plus existing fullscreen and installed-display tests. Card/AI/checkpoints/save format untouched. Full Node24 build and physical-device UI are still pending; v0.197 is the last verified executable.

### 2026-11-23 — v0.287 candidate (source-only)
- Failed browser fullscreen requests on an already-rotated landscape screen now show an actionable and dismissible on-screen explanation (including installable PWA alternative), rather than only updating a hidden portrait guide. Feedback stays in a safe-area fixed overlay without expanding the game canvas.
- Focused tests 2/2; card/AI/balance/save data unchanged. The UI feedback has NOT been physically tested on a phone; verified executable is still v0.197.

### 2026-11-23 — v0.288 candidate (source-only)
- Returning from deck maker or opening it from within the play panel restores keyboard focus to the persistent corresponding game-menu tab on the next animation frame. Previously a disappearing in-panel button could strand keyboard and screen-reader users on the document body. Normal tab clicks keep their existing focus.
- Added identifiable menu-tab attributes and two focused tests. No card, AI, gameplay, or local-save schema change. Full Node24 build and phone E2E not available here; v0.197 remains last verified binary.

### 2026-11-23 — v0.289 candidate (source-only)
- When Battle unmounts after saving, leaving or completing a match, keyboard focus returns to the selected persistent lobby tab after React mounts the lobby. Initial lobby startup remains untouched; fast rematches cancel stale focus frames.
- Focused source tests 2/2; no gameplay, AI, card, or storage schema changes. Still source-only pending Node24/native-browser verification.

### 2026-11-23 — v0.290 candidate (source-only)
- The mandatory portrait rotation guide now stacks above the PWA update/install banner (70,000 vs 60,000), preventing a cache/update toast from intercepting the rotation action before the phone is turned sideways. Dedicated regression checks the real two stylesheets. No game-rule/AI/save change.
- Full latest Node24 build and physical mobile UI are still unverified; previously verified v0.197 game binary remains the standalone PWA fallback.

### 2026-11-23 — v0.291 candidate (source-only)
- Installable PWA update/install banner is visually deferred while `.game-main .duel-screen` is visible; `visibility:hidden;pointer-events:none` keeps it from covering attack/turn and choice controls and automatically reveals the same queued status on return to the lobby. No active patch is forced, no user save is erased. Modern `:has()` feature required; older browsers retain the dismiss button.
- Standalone PWA wrapper for the VERIFIED old game executable v0.197 rebuilt with new release hash; real old v0.197 package upgrade and rollback tests 18/18 passed, CSS source tests 2/2. New v0.291 React game source remains NOT COMPILED (Node24/dependencies unavailable). No card/AI/save schema changes.

### 2026-11-23 — v0.292 candidate (source-only)
- Deferred optional fullscreen-denial toast only during active duel with CSS visibility and pointer-events; preserved its state to show in lobby. Added regression. Core data unchanged.

- Tightened legacy drag regression scope to its actual CSS rule; unrelated PWA overlays now safely use pointer-events:none without causing false failures.

### 2026-11-23 — v0.293 candidate (source-only)
- PWA defers ordinary installation and patch-ready banners during matches but keeps critical asset integrity, install failure and cache validation warnings visible with data-urgent. Asset-load watchdog flags critical failures. This prevents hidden corruption notices during an active match; controls and data unchanged. PWA installer v0.197 requires rebuild for this shell change.

### 2026-11-23 — v0.294 candidate (source-only)
- Added dependency-free reproducible `scripts/package-playable-pwa.mjs`: validates content-addressed service worker hashes for all 7 cached assets, confirms real v0.197.0 compiled JS/CSS byte equality with verified standalone, checks landscape PWA manifest and refuses archive overwrite. Produces ZIP with only verified 8 PWA assets plus explicit install instructions; does NOT claim v0.294 React source is built. 2 focused packaging tests. Saved-card/AI/checkpoint contents untouched.

### 2026-11-23 — v0.295 candidate (source-only)
- Integrated reproducible playable-PWA integrity ZIP into Node24 CI only AFTER full typecheck, gameplay tests, React build, PWA upgrade tests, and preflight succeed. Packager tests now use the real stamped package version instead of hardcoding v0.197, allowing eventual fully compiled candidate releases. CI automatically uploads standalone HTML, PWA folder and verified PWA ZIP as one 7-day test artifact; does not publish or install on devices. Existing v0.197 binary remains unchanged locally; no online deployment.


### 2026-11-23 21:19 KST — v0.296 source candidate: make real-browser playability a release gate
- Prioritized obtaining a genuinely usable installed landscape PWA, rather than new cards or AI 25-level tuning.
- Added compiled-PWA Chromium release test covering landscape lobby → mulligan → first turn, no whole-document horizontal/vertical scroll at 844×390, 667×375 and 1024×600, vertically aligned heroes, a usable Turn End button and no page JS errors.
- Updated existing PWA offline-save-and-resume browser test from portrait to landscape to match the new rotation policy.
- CI now installs Chromium and runs both browser tests after fresh Node24 build/PWA verification and before preflight/artifact publication; a browser failure blocks publishing test artifacts.
- Locally verified: playable core 646/646, PWA emulator 17 passed/1 skipped, frontend syntax 65 files and data baseline intact. In actual Chromium, previously compiled v0.197 launched an AI battle, completed starting hand and reached turn 1 with no page exceptions; its 844×390 document still has vertical overflow (not the v0.296 code).
- Blockers: Node24 + pinned React/Vite npm packages unavailable in this isolated runtime, so v0.296 full build and new HTTP/Chromium E2E have NOT run. Existing executable v0.197 must remain separate. No external deployment or live phone test.
- Next: push complete latest candidate source to GitHub then run .github/workflows/validate-playable.yml; fix failures and publish HTTPS PWA only after a complete passing build; verify phone touch, install and persistent saves.

2026-11-23 | v0.296 source-only | Added complete local candidate-to-playable build helper with Node24/pinned npm, source marker validation, automated gameplay/React/PWA checks, safe previous-binary rollback on failure, output hashes; 650/650 playable-core, 2/2 actual engine games, source/CI guards 9/9. No new React build in Node22 offline sandbox; last playable v0.197 retained. AI 25-stage training deferred.


### 2026-11-23 21:24 KST — v0.297 integrated source candidate (two v0.296 branches merged)
- Reconciled concurrent v0.296 source branches; preserved both the gitless Node24 local build helper (6ecafe0) and the compiled-PWA real Chromium landscape release gate (4a4f914).
- Local builder now installs Chromium and requires both complete offline PWA save/resume browser test and landscape no-scroll/hero-alignment test before promoting a new compiled playable artifact. Failed build retains old compiled executable.
- Build remains source-only on this isolated Node22 host without npm/React/Vite dependencies; a device/online release must not be claimed until full Node24 CI/local build and human phone testing pass.
