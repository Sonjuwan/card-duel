# v0.323.0 performance candidate — validation checkpoint

Base: `15802d04696b51239e3ca30db912de2606ad0e47`, branch `ui/followup-20261125`.
Candidate branch: `perf/v0.323-static-render`, draft PR #3.
Release number intentionally unchanged. No merge or deployment.

## Candidate changes

- Memoize card/hero/power art, card backs, static tabletop and glyphs, and opponent hidden hand.
- Split mana and deck readouts into memoized scalar-prop subtrees; preserve accessible labels and animation flags.
- Isolate effects, impact history, and dialogue captions from unrelated render updates; memoize the filtered impact history to preserve reference identity.
- Replace touch-target sorting and visible insertion-slot temporary arrays with single-pass selection. Keep illegal targets, ambiguity tolerance, clipping, invalid geometry handling, and deterministic tie behavior.
- Add two render regression cases, two seeded touch geometry differential cases, and a repeatable microbenchmark script.

## Evidence actually obtained

- GitHub branch comparison: only client components, gesture logic, tests, and benchmark/documentation changed. Card definitions, game engine, AI weights, storage schema, and release metadata untouched.
- Exact JS mirrors of old/new algorithm bodies compared: 30,000 seeded nearest-target cases and 30,000 visible-slot cases, all equal. The latter includes non-finite and extreme coordinates.
- Isolated Node 22.16.0 microbenchmark (copied function bodies, 16 target rectangles and 8 insertion slots, 160,000 calls per run, seven alternating-order trials, medians): nearest target 297.56 → 102.49 ms; visible slot 59.47 → 7.39 ms. An additional 8,192 points matched for both operations. These are function-only CPU timings, NOT real mobile frame or end-to-end drag latency.
- Repository's Node 24 regression suite, production build, SSR tests and browser profile NOT executed here. Direct clone failed DNS; available local runtime Node 22; no CI result present at last check. No evidence yet that memoization improves actual frames.

## Required before merge/deploy

1. Check out candidate on a Node 24 environment with installed dependencies.
2. Run `npm run typecheck`, `npm test`, `npm run test:render`, `npm run verify:release-baseline`, `npm run build:playable-local`, `npm run test:package-pwa`.
3. Run `node scripts/performance-touch-geometry.mjs` against the actual checkout.
4. Compare v0.323 and candidate with the existing CPU-limited mobile Chromium active-combat scenario in `PERFORMANCE_HISTORY.md` (PERF-F03); verify gesture selection, command count, effects, log/caption freshness, frame p95/p99, and long animation frames. Alternate run order and use repeated trials.
5. Test real Android PWA, including drag, tap, scroll, update, offline restore and saved progress. Reject any regressions; version and publish only after validation.

## Next work

Follow the existing queue: profile local drag style writes and PWA image bundles with real browser traces. Do not reintroduce PERF-D02 or the earlier image split that failed installation performance validation without new evidence. Keep animation duration, art quality and AI strength unchanged.


## Follow-up checkpoint — sequential work

- Drag-write diagnostic: `CARD_DUEL_PROFILE_DRAG_WRITES=1` on the existing active-combat Chromium test counts writes to the four drag/cast CSS custom properties and repeated values. Run independently of the frame-timing profile; instrumentation is not a timing benchmark. Diagnostic code committed, browser execution pending.
- AI benchmark: `CARD_DUEL_FIXED_NODES=1 npm run benchmark:device -- 3 25 all mid` disables the wall-clock search deadline while preserving device node/response budgets and emits SHA-256 fingerprints of ranked and accepted actions. This supports before/after comparison without changing production AI. Actual AI benchmark execution pending.
- Impact feedback: aggregate damage, armor, hit counts and flags in a single pass without intermediate arrays. Exact JS mirrors of both bodies matched 30,000 seeded mixed-event cases; corresponding repository regression test added. No claim of FPS improvement or full test passage.
- Next measurement-dependent task: execute the browser diagnostics and AI baseline; use the results to select local CSS write scoping or AI search candidates. Do not change PWA asset packaging or engine search policy without the respective baseline and regression checks.


## Integrated checklist validation — run 45748308430

- Fixed-node AI comparison at level 25: three pairs, 12 positions per run, identical ranked and accepted SHA-256 digests. Median of per-run median search times 45 → 27 ms. Median p95 133 → 135 ms; tail improvement not demonstrated.
- Shared style entry: generated `game.css` compared byte-for-byte equal to v0.323 baseline.
- Chromium combat 4/4 and PWA browser 2/2 passed.
- Main regression 981/982: one source-level layout test still expected direct CSS imports; corrected in follow-up to assert the shared entry and the underlying required style.
- Engine dense public view SHA-256 equal. Checkpoint median ~49.2 → 48.4 µs; no meaningful improvement established.
- Storage five-turn acknowledgment samples: median of run medians ~13.8 → 14.8 ms; not an improvement. IndexedDB writes remain durable and synchronous.
- Sixty restore/exit cycles: GC-sampled page heap 6,914,508 → 6,915,260 bytes at cycle 60; DOM nodes 1,566 and zero dedicated workers for both. No demonstrated heap improvement; physical GPU, battery and heat still unmeasured.
- Eight-bundle PWA prototype: all 458 image declarations reconstructed, 48 overlapping computed art observations matched. CPU-4x mobile install 1,210 → 1,329 ms, offline menu 693 → 806 ms; desktop install 1,185 → 1,326 ms, offline menu 671 → 795 ms. Main CSS plus bundles is larger than original CSS (15,862,773 vs 15,829,661 bytes). Reject this prototype for production; keep current intact art and cache format.
- Follow-up: reuse the ledger membership Set when checking recent matches. Add a 10,001-ID preservation, duplicate and missing-ID regression test. Pending full validation.

- Integrated combat profile (three alternating-order pairs): p95 16.8 ms and p99 33.4 ms on both; long-frame counts baseline 7/2/5, candidate 4/2/1. Forced layout medians 161.7 → 33.0 ms.
- Scoped-drag experiment compared to the integrated pre-scope candidate: three pairs, p99 ~33.4 ms both, long-frame counts 7/2/4 → 0/0/0; forced style/layout in long-frame entries 104.9/26.2/77.2 → 0/0/0 ms. No claim that all layout work was eliminated. Normal combat and three timed scenarios passed. Adopted scoped-drag implementation; full post-integration test pending.


## Run 45749081368 — storage and clock adoption

- Regression: 983/983, render 65/65, packaging 2/2, PWA service-worker tests 19 pass / 1 optional previous-release test skipped; browser job passed. Scoped drag and lifecycle jobs were cancelled by later pushes; previous run results remain historical evidence.
- AI fixed-node comparison: median of run medians 23 → 12 ms, p95 68 → 63 ms, identical decision digests. CPU-4x integrated combat compared to v0.323: long frames 3/2/3 → 0/0/1; median p99 33.4 → 33.2 ms. No physical-device claim.
- Storage/clock experiment 42/42 unit checks, 4/4 browser combat checks. Three alternating pairs each showed match writes 17 → 17 and growth writes 17 → 0. Total writes 34 → 17, acknowledgment latency not materially improved. Adopted both changes. Countdown boundary model 122 → 31 callbacks over 30.5 s; actual device power unmeasured.
- Compiler source audit flagged seven unused bindings in six files; removed imports / renamed intentionally unused callback parameter. Added strict audit gate; post-cleanup audit pending.
- Asset inventory: all 458 WebP assets unique; no removable EXIF/XMP bytes. CSS 15,829,661 bytes; gzip 11,745,471, Brotli q5 11,701,353. Grouped PWA again slower on CPU-4x mobile (install 1,106 → 1,386 ms; offline menu 619 → 885 ms). Retain original packaging.
- Added read-only largest-24 WebP experiment with exact decoded PAM equality and smaller bytes required, excludes animated/profiled/metadata assets. No image quality changes or release art writes. Result pending.
- No merge/release; complete post-adoption verification and physical Android checks before publication.


## Run 45749983415 — cleanup and lossless art results

- Post-adoption regression 985/985, render 65/65, packaging 2/2, CSS entry 1/1, strict unused bindings 0. Service-worker checks 19 pass, one optional prior-release test skipped.
- Largest 24 WebP lossless re-encodings: 24 decoded PAM comparisons equal, zero smaller encodings. Reject and retain original art; no claim about untested encodings or the remaining assets.
- Repeated 60 restore/exit cycles: heap 6,902,760 vs 6,924,788 bytes; both 1,566 DOM nodes and zero remaining dedicated workers. No heap reduction established.
- Added memoized collection group/spread reuse and unread-ID Set membership; page selection preserves the original clamping logic and avoids a second complete grouping pass. Added 96 equivalent page cases across scopes and sizes. Released finished save-probe worker references and handlers. Post-change regression pending; no measured memory reduction claimed.
- Latest published baseline unchanged. Keep physical Android measurements as an explicit outstanding gate.


## Run 45750223920 and isolated experiments 45750685855 / 45751166134

- All nine jobs of run 45750223920 passed. Regression 986/986, render 65/65, PWA packaging 2/2, prior-release optional worker check skipped. Scope-combat and lifecycle comparisons completed. CPU-4x combat versus original v0.323: median p99 50 → 33.4 ms, long frames 15/14/10 → 2/1/3, forced layout in long-frame entries 556.6 → 45.9 ms (median). These are host-browser synthetic results, not phone FPS guarantees.
- Atomic-save experiment PR #4: 40/40 local unit tests, 5/5 browser checks. Three browser trial pairs each preserved 17 durable match writes and zero redundant growth writes; standalone growth transactions 17 → 0, match-and-growth transactions 17 → 17. Worker acknowledgment medians approximately 14.9 → 15.1 ms across trials: no speedup established. Adopted four files only, retaining the boolean API and fallback for other store implementations. Full post-adoption regression pending.
- Additional engine experiment PR #5: 12/12 unit tests; 32 positions from nine-class seeded games, three trials per each of three policies; ranked and accepted action digests identical. Policy median-of-medians 14 → 13, 21 → 21, 20 → 19 ms. No meaningful default-policy benefit established. Keep isolated, do not integrate merely because tests pass.
- Added active gameplay lifecycle profile: eight fresh ranked matches per variant, up to five acknowledged player turns each, normal rendering, return to menu, collect page heap, DOM/listeners, worker termination, CDP script/layout durations, compositing layer/paint counts and optional browser-process CPU time. Synthetic browser proxy only; not a physical GPU memory/power/temperature reading. Pending execution.
- Original art remains unchanged. No adjacent exact duplicate CSS rules detected in the non-art styles by a limited textual scan; not proof all cascade redundancy has been eliminated. No new package format adopted.
- Do not claim physical device validation or deployment. Preserve baseline until final regression and device review.
