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
