# Event sequence + artboards — handoff for the next implementer

## Symptoms (user report)

- Clicking **steps** in the event sequence UI does **not** run the recorded interactions or show the expected post-step state on **either** artboard (template / solution).
- **Static** preview on the template side often shows **no** image (only **interactive** iframe path seemed to work intermittently).
- **Snapshots** on each `EventSequenceStep` are **frozen at record time**; driving previews from **live** `level.code` / `level.solution` + **replay** was attempted but the overall behavior is still **broken** or **fragile**.

---

## Checklist: what was attempted (in rough order)

Use this as a map of the codebase; **do not assume any single item fully fixed the product**.

- [x] **`eventSequence` never reached the API** — Template Yjs debounced PUT in `Editors.tsx` sent **only** `{ code }`, so DB stayed at 0 steps. **Fixed:** merge **`eventSequence` from `store.getState().levels[levelIndex]`** into that PUT when non-empty; **and** debounced **`PUT { eventSequence }`** from `Frame.tsx` after `appendEventSequenceStep` (recording does not touch Yjs, so Yjs-only save never ran).
- [x] **Stale DOM after recording (step 1 = Initial still “Open”)** — While recording, `replaySequence` stays `[]` and the live iframe mutates the DOM; when recording stops, **signature does not change** (`""`→`""`), so drawboard **never** baseline-reset. **Fixed in** `drawBoard/src/main.ts` **options-patch:** **`needsBaselineReset`** also when **`recordingEnded && incomingReplay.length === 0`**.
- [x] **Step scrub did not replay in browser capture mode** — `scheduleRenderReady` **browser** branch called **`captureBrowser()`** and **returned** without **`replaySequenceIfNeeded()`**, so selecting step 2 left `#status` at baseline **Closed**. **Fixed:** **`await replaySequenceIfNeeded()`** before **`captureBrowser()`** in that branch.
- [ ] **Template persistence (Yjs vs Redux vs autosave)** — `Editors.tsx`: creator-only **debounced PUT** `{ code }` from Yjs template text, mirroring the existing solution PUT path; comments clarifying Redux `updateCode` as the single Redux sync.
- [ ] **Template artboard + step scrub** — `ScenarioDrawing.tsx`: **`stepScrubNeedsLiveTemplateFrame`** so the live iframe stays on when an event sequence exists (not only when `selectedSequenceIndex >= 0`); align **`INITIAL_EVENT_SEQUENCE_STEP_ID`** handling with `ScenarioModel`.
- [ ] **Drawboard `options-patch` without DOM reset** — `drawBoard/src/main.ts`: on replay signature change, **re-apply** `lastAppliedHtml` / `Css` / `Js` before replay; **selective** clearing of `replayAppliedSignature` (avoid double replay on identical patch; reset when interactive/recording/replay prefix changes).
- [ ] **Frame options-patch never first-posted** — `Frame.tsx`: replace “first run only stores key” with **`lastPostedOptionsPatchKeyRef`** dedup; **`iframe` `onLoad`** bumps state so the effect runs when `contentWindow` exists.
- [ ] **Template Frame never persisted sequence steps** — `ScenarioDrawing.tsx` creator `Frame` did not pass **`persistRecordedSequenceStep`** (only `ModelArtContainer` did), so `recorded-event-sequence-step` postMessages were ignored and the API stayed at 0 steps. **Fixed** by passing **`persistRecordedSequenceStep={isSequenceRecording}`** alongside `recordingSequence`.
- [ ] **Playwright smoke used removed UI strings** — Navbar now uses **“Start sequence”** / **“Stop & save”** under the **Interactions** tab, not “Start recording”. Smoke scripts updated to open Interactions and match the new labels.
- [ ] **Solution artboard: live code + replay** — `ScenarioModel.tsx` + `ModelArtContainer.tsx`: **`replaySequence`**, **`interactionTriggers`** from `stepToInteractionTrigger`, **`snapshotOverride: null`** when using live solution scrub; pass **`interactionTriggers`** into `Frame` instead of only `level.events`.
- [ ] **Solution artboard: force interactive when sequence exists** — `ScenarioModel.tsx`: **`stepScrubNeedsLiveSolutionFrame`** (same idea as template’s forced live frame) so `interactiveOverride` is not false whenever **`solutionUrl`** exists (otherwise drawboard **`replaySequenceIfNeeded`** bails on `!interactive`).

---

## Why it’s still hard (architectural)

1. **Two sources of truth** — Editor/Yjs/Redux vs **per-step `snapshot`** on `EventSequenceStep`; previews mix **live** code, **replay**, and **frozen** snapshots inconsistently.
2. **Three channels to the drawboard** — Full `postMessage` on mount, **`reload`** on html/css/js change, **`options-patch`** for flags/events/replay; ordering and **stale DOM** bugs are easy.
3. **`replaySequenceIfNeeded`** in `drawBoard/src/main.ts` requires **`interactive === true`** and skips when **`recordingSequence`** is true; easy to accidentally **never replay**.
4. **Static** images use **`POST /api/drawboard/render`** with **`step.snapshot`** — **always stale** after edits unless you **re-render from current code** (or drop static previews for sequence scrub).

---

## Recommendations for the next LLM (simplify “the proper way”)

1. **Pick one preview model for creator step scrub**
   - **Option A:** Always **live iframe** only (no static thumbnails for scrub). Simplest mentally.
   - **Option B:** Static thumbnails are **always** `render(liveSolutionOrTemplate, replayPrefix)` server-side or **one** shared “capture pipeline” — **never** trust `step.snapshot` for UI.
2. **Single component** or **single hook** for “step N preview” — both artboards call **the same** `useEventSequencePreview(stepIndex)` that returns `{ html, css, js, replaySteps, interactive }` instead of diverging `ScenarioModel` vs `ScenarioDrawing`.
3. **Reduce drawboard state machines** — Consider **always** sending a **full** payload on step change (accept cost) **or** a single **`reset + apply` + replay** in one message to avoid `options-patch` / reload races.
4. **Instrument** — Temporary `console.log` in drawboard `options-patch`, `replaySequenceIfNeeded`, and first `replaySequenceStep` when `querySelector` misses (today failures are often **silent**).

---

## Playwright regression

### Script

- **`scripts/playwright-event-sequence-artboard-smoke.mjs`** — copied from **`playwright-interaction-events-smoke.mjs`**, then extended with **`assertArtboardStepScrubAfterPersist`**: after persistence, clicks **Event step 1** (Initial) and **Event step 2** (first recorded interaction) and asserts the **visible** template drawboard `#status` goes **Closed → Open** (same demo HTML as the interaction smoke).

### Run

```bash
# App + DB + ws on localhost:3000 as usual for other pw scripts
npm run pw:event-sequence-artboard
# or: bun run pw:event-sequence-artboard
```

### If the test fails

- **No visible** `iframe` with `name=drawingUrl` and not `aria-hidden` — static vs interactive preview gating; align with `findVisibleDrawboardFrame` selector.
- **Timeout on #status** — replay not running (`!interactive`, `recordingSequence`, or replay blocked); use browser devtools on drawboard iframe.
- **Extend** the test with **solution** iframe assertions once `solution` HTML is seeded to match template in the smoke level.

---

## Key files (reference)

| Area | Files |
|------|--------|
| Artboards | `components/ArtBoards/ArtBoards.tsx`, `ScenarioDrawing.tsx`, `ScenarioModel.tsx`, `ModelArtContainer.tsx`, `Frame.tsx` |
| Drawboard runtime | `drawBoard/src/main.ts` |
| Editor / save | `components/Editors/Editors.tsx`, `useLevelSaver.ts` |
| Types | `types.ts` — `EventSequenceStep`, `DrawboardSnapshotPayload` |
| Existing interaction smoke | `scripts/playwright-interaction-events-smoke.mjs` |

---

## Todo for next agent (short)

1. **`npm run pw:event-sequence-artboard`** should be green after the fixes above; if it flakes, see **Navbar** Start/Stop swap and **`findVisibleDrawboardFrame`** (visible + test id).
2. **Simplify long-term:** one hook for step preview (`useEventSequencePreview` is a start), fewer drawboard branches (`browser` vs `playwright` must both replay + capture consistently), and consider **not** relying on empty `replaySequence` meaning “fresh baseline” without an explicit **reload** or **reset token**.
3. Remove **debug** `console.log` in **`drawBoard/src/main.ts`** (`[drawboard:options-patch]`, `[drawboard:replay]`) if you want quieter production bundles.
4. **Delete or trim** this doc once the feature is stable if the team prefers not to keep long handoffs.
