# Classroom Incident Status

This file tracks the March 2026 classroom/group-work investigation.

It has two goals:

1. Keep the completed fixes and their proof steps in one place.
2. Keep the remaining verification and debugging work as explicit todos.

## Completed

### 1. Partial group points on submit

Status: fixed locally and verified

Problem:
- A group could finish together, but only part of the group was attached to the final attempt/submission payload.
- This matched the classroom symptom where some members got points and others got `0`.

Root cause:
- Group participant resolution depended too much on partial gameplay telemetry.
- If telemetry contained only some users, those users could replace the actual group membership set.

Fix:
- Group submissions now reconcile against real `group_members` and then merge telemetry on top of that instead of letting partial telemetry define the participant set.

Main files:
- `app/api/_lib/services/gameStatisticsService.ts`
- `app/api/games/[id]/finish/route.ts`

How to prove:
```bash
PLAYWRIGHT_SCENARIO=baseline PLAYWRIGHT_HEADED=false npm run pw:local-group
```

Expected result:
- Group submit summary should pass for all members.
- The old local repro where a 3-person group persisted only 2 members should no longer happen.

### 2. Waiting-room roster showing wrong or duplicated people

Status: likely fixed

Problem:
- The classroom report included cases like "multiple Sofias" and cases where some names were missing from the visible group list.

Root cause:
- The waiting-room roster was reading live websocket presence too directly.
- Refresh/reconnect churn could duplicate or temporarily lose live users even when persisted group membership was correct.

Fix:
- The waiting-room roster now uses persisted `/api/groups/:id` membership as the authoritative member list.
- Websocket presence is only used to show `Connected` / `Offline`.

Main files:
- `app/api/groups/[id]/route.ts`
- `app/game/[gameId]/GamePageClient.tsx`

How to prove:
```bash
PLAYWRIGHT_SCENARIO=classroom_churn PLAYWRIGHT_HEADED=false PLAYWRIGHT_USER_COUNT=12 PLAYWRIGHT_GROUP_SIZE=3 npm run pw:local-group
```

Expected result:
- `stress:join-snapshot` and `stress:start-snapshot` keep full group membership through waiting-room reloads and late opens.

### 3. Plussa `_aplus_group` routing for app-owned groups

Status: fixed and clarified

Problem:
- Old prod code accepted LTI launches that contained `_aplus_group`, but still sent users into the generic app-group flow.
- Earlier A+ exercise configuration limited group size to `1..1`, which caused Plus to expose the whole course as a single effective group in group exercises.

Root cause:
- The old route explicitly dropped LMS group binding and always launched with `groupId: null`.
- The exercise configuration prevented meaningful Plus subgroup identity from being passed through in the first place.

Fix:
- LTI game launch now reads `_aplus_group` and resolves a deterministic app-owned group for that Plus group when the value is present and not `0`.
- The generic lobby can be skipped for that path.
- The exercise can now allow group size `1..N`, which still supports the app's individual submit model while allowing real Plus groups to be passed through.

Main files:
- `app/api/lti/game/[gameId]/route.ts`

How to prove current behavior:
```bash
PLAYWRIGHT_SCENARIO=lti_aplus_group \
PLAYWRIGHT_GAME_ID=839fb617-ae50-4236-916e-bc4c83878358 \
PLAYWRIGHT_USER_COUNT=12 \
PLAYWRIGHT_GROUP_SIZE=3 \
PLAYWRIGHT_HEADED=false \
npm run pw:local-group
```

Expected result:
- users in the same non-zero `_aplus_group` land on the same app-owned `groupId`
- users in different non-zero `_aplus_group` values land on different app-owned `groupId`s
- users can still submit individually inside the app even though the launch was group-scoped

How old prod behavior was proven:
```bash
git worktree add ../css_artist-prod-repro d43c346539e5b5e9bce8621b67a209ea3d0ef8ea
```

Then run the old app and inspect LTI launch logs.

Observed on old prod commit `d43c346539e5b5e9bce8621b67a209ea3d0ef8ea`:
- incoming payload contained `_aplus_group`
- route still logged:
  - `group scope: pending value: null groupId: null`

Configuration note:
- The current decision is to use Plus groups when `_aplus_group` is present and not `0`.
- This is compatible with the app's individual submit behavior because the app still submits one result per member, not one shared LTI group submission.

### 4. Distinct user names after `_aplus_group` auto-routing

Status: verified

Problem:
- If users are auto-routed into an app-owned group instance, their names must remain distinct in the waiting room / avatar stack.

Fix:
- No special UI fix was needed for this part after routing; verification was added to the Playwright LTI scenario.

Main files:
- `scripts/playwright-local-group-smoke.mjs`
- `app/game/[gameId]/GamePageClient.tsx`

How to prove:
```bash
PLAYWRIGHT_SCENARIO=lti_aplus_group \
PLAYWRIGHT_GAME_ID=839fb617-ae50-4236-916e-bc4c83878358 \
PLAYWRIGHT_USER_COUNT=12 \
PLAYWRIGHT_GROUP_SIZE=3 \
PLAYWRIGHT_HEADED=false \
npm run pw:local-group
```

Expected result:
- each `_aplus_group` summary line ends with `PASS`
- visible waiting-room labels and avatar titles show the expected distinct names for every member

### 5. Slow / stale co-editing under latency and classroom churn

Status: fixed locally and verified

Problem:
- The classroom report said co-editing was slow, stale, and sometimes required refreshes.

Root cause reproduced locally:
- The old custom patch path could lose or corrupt editor state under latency/jitter.
- During the Yjs migration, the main remaining bug was a dual bootstrap in Yjs mode: editor text was initialized from both `room-state-sync` and the server `yjs-sync`, which doubled the initial document and broke convergence.

Fix:
- Collaboration was migrated to the Yjs-backed path in the current local default.
- In Yjs mode, editor text is now bootstrapped from the server `yjs-sync` document only.
- The duplicate room-state text hydration path was removed for Yjs editors.

Main files:
- `components/Editors/CodeEditor/useCodeEditorCollaboration.ts`
- `components/Editors/CodeEditor/useYjsCodeEditorCollaboration.ts`
- `lib/collaboration/CollaborationProvider.tsx`
- `ws-server/server.mjs`

How to prove:
```bash
PLAYWRIGHT_SCENARIO=classroom_churn PLAYWRIGHT_HEADED=false PLAYWRIGHT_USER_COUNT=12 PLAYWRIGHT_GROUP_SIZE=3 npm run pw:local-group
PLAYWRIGHT_SCENARIO=latency PLAYWRIGHT_HEADED=false PLAYWRIGHT_USER_COUNT=8 PLAYWRIGHT_GROUP_SIZE=4 npm run pw:local-group
```

Verified result:
- classroom churn:
  - all 4 groups `PASS | PASS | 3/3 | PASS | PASS`
- latency:
  - both 4-person groups `PASS | PASS | 2/2 | PASS | PASS`

Remaining caveat:
- still worth one real production validation session before calling it fully done in prod

## Open Todos

### 1. Sudden HTML lock

Status: unresolved

What is known:
- lock logging was added
- no unexpected `lockHTML` flip has been reproduced yet
- prod symptom still lacks a confirmed root cause

Todo:
- reproduce a case where users report "HTML is suddenly locked"
- confirm whether `lockHTML` actually changes
- if no lock flag changes, determine whether the symptom is actually stale editor state / desync

Relevant files:
- `ws-server/server.mjs`
- `components/Editors/EditorTabs.tsx`
- `components/Navbar/Navbar.tsx`

Suggested proof:
```bash
PLAYWRIGHT_SCENARIO=classroom_churn PLAYWRIGHT_HEADED=false PLAYWRIGHT_USER_COUNT=12 PLAYWRIGHT_GROUP_SIZE=3 npm run pw:local-group
```

Then inspect:
- ws-server logs for `lockHTML`, `lockCSS`, `lockJS`
- client logs for `lock_toggle_click`

### 2. Persisted membership consistency in the new LTI auto-group path

Status: unresolved

What is known:
- visible waiting-room roster and avatars are correct in the new `_aplus_group` flow
- but `/api/groups/:id` previously came back empty in that specific LTI test path
- this should be rechecked now that the Plus-group decision is finalized and the routing path is stable

Todo:
- verify whether `group_members` rows are actually missing or whether the API is reading the wrong membership view
- compare:
  - visible waiting-room roster
  - `/api/groups/:id`
  - direct DB `group_members`

Relevant files:
- `app/api/lti/game/[gameId]/route.ts`
- `app/api/groups/[id]/route.ts`

Suggested proof:
```bash
PLAYWRIGHT_SCENARIO=lti_aplus_group \
PLAYWRIGHT_GAME_ID=839fb617-ae50-4236-916e-bc4c83878358 \
PLAYWRIGHT_USER_COUNT=12 \
PLAYWRIGHT_GROUP_SIZE=3 \
PLAYWRIGHT_HEADED=false \
npm run pw:local-group
```

Then inspect:
- `lti:join-snapshot ... members=`
- DB rows for `group_members`

### 3. Production validation of the new Plus-group flow

Status: pending

What is known:
- local classroom and latency proofs are green
- the route now uses Plus groups when `_aplus_group` is present and not `0`
- the app still relies on individual submission fan-out, not shared LTI group submission

Todo:
- deploy the current build to a controlled environment
- verify that real Plus launches with non-zero `_aplus_group` values:
  - skip the generic lobby when appropriate
  - land each Plus subgroup in the correct app-owned group
  - preserve distinct names
  - still submit points to all members individually

Suggested proof:
```bash
PLAYWRIGHT_SCENARIO=lti_aplus_group \
PLAYWRIGHT_GAME_ID=<deployed-game-id> \
PLAYWRIGHT_USER_COUNT=12 \
PLAYWRIGHT_GROUP_SIZE=3 \
PLAYWRIGHT_HEADED=false \
npm run pw:local-group
```

Then validate with a real Plus launch and production logs.

## Notes

- Current local fixes were committed as:
  - `efee450` `Add multiplayer diagnostics and LTI replay harness`
- Old production reference commit used for comparison:
  - `d43c346539e5b5e9bce8621b67a209ea3d0ef8ea`
- Old prod commit reproduced the `_aplus_group` routing gap, but it also mismatched the current DB schema (`projects.group_id`) so not every old failure can be replayed directly without historical schema alignment.
