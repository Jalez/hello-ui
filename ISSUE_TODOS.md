# Issue Todos

Last updated: 2026-03-13

This file captures issue candidates from the 2026-03-13 production log pull in
`exported-logs/prod-20260313-183253/`.

## Closed / No Issue

### 1. Prod schema drift on `projects.allow_duplicate_group_users`

Status: resolved in production, do not open a new issue unless it regresses.

Evidence from the original log pull:
- `exported-logs/prod-20260313-183253/db.log:7`
- `exported-logs/prod-20260313-183253/app.log:9`
- `migrations/20260312193000-add-project-duplicate-group-users.js:5`

Notes:
- The production database was behind the deployed app code at the time of the
  log export.
- This has since been fixed by updating the production schema.

### 2. `_aplus_group=0` resolves to "no subgroup"

Status: expected behavior, not a bug.

Evidence:
- `exported-logs/prod-20260313-183253/app.log:153`
- `exported-logs/prod-20260313-183253/app.log:160`
- `exported-logs/prod-20260313-183253/app.log:175`
- `exported-logs/prod-20260313-183253/app-debug-logs/debug-2026-03-13T13-27-37.jsonl:8`
- `exported-logs/prod-20260313-183253/app-debug-logs/debug-2026-03-13T13-27-37.jsonl:12`

Notes:
- When A+ sends `_aplus_group="0"`, the app intentionally routes the user
  without a concrete subgroup.
- This should stay documented, but it should not become a GitHub bug issue.

## Ready To Turn Into Issues

### 3. Prevent WS process crashes on malformed frames and add socket-level error handling

Status: ready

Problem:
- The WebSocket server crashes on malformed frames instead of isolating the bad
  connection.
- The container restarts and active collaboration sessions are interrupted.

Evidence:
- `exported-logs/prod-20260313-183253/ws-server.log:11565`
- `exported-logs/prod-20260313-183253/ws-server.log:11589`
- `exported-logs/prod-20260313-183253/ws-server.log:11760`
- `exported-logs/prod-20260313-183253/ws-server.log:11784`

Acceptance criteria:
- A malformed or compressed-invalid frame must not terminate the WS process.
- Add per-socket `error` handling and explicit logging around close/error paths.
- Add a regression test that injects a bad frame or equivalent malformed client
  behavior and verifies the process stays up.
- Add a lightweight counter or metric for bad-frame disconnects.

### 4. Reproduce and fix collaborative desync / overwritten edits in group rooms

Status: ready

Problem:
- Users reported that group edits were overwritten and only one user could keep
  editing.
- The current classroom smoke coverage did not catch the real classroom failure
  mode.

Evidence from logs:
- Multiple real group rooms show active multi-user editing traffic, so the
  feature is being exercised in production:
  - `exported-logs/prod-20260313-183253/ws-server.log:154`
  - `exported-logs/prod-20260313-183253/ws-server.log:203`
  - `exported-logs/prod-20260313-183253/ws-server.log:217`
- Production also shows the same account entering shared group rooms multiple
  times as `session-2`, `session-3`, which is a plausible desync amplifier:
  - `exported-logs/prod-20260313-183253/ws-server.log:158`
  - `exported-logs/prod-20260313-183253/ws-server.log:171`
  - `exported-logs/prod-20260313-183253/all-services.log:13755`
  - `exported-logs/prod-20260313-183253/all-services.log:13769`
- The server already documents this risk in code:
  - `ws-server/server.mjs:1123`
  - `ws-server/server.mjs:1126`

Evidence about the current test harness:
- The repo already has a collaboration smoke script with duplicate-user and
  stress scenarios, but the real failure still escaped:
  - `scripts/playwright-local-group-smoke.mjs:40`
  - `scripts/playwright-local-group-smoke.mjs:1293`
  - `scripts/playwright-local-group-smoke.mjs:1901`

Acceptance criteria:
- Reproduce one real overwrite/desync case locally or in a controlled deployed
  environment.
- Capture enough telemetry to explain which side overwrote which version and
  why.
- Add a failing automated test that reproduces the issue before the fix.
- Add a passing automated test after the fix for at least:
  - concurrent edits by two distinct users
  - duplicate-tab / duplicate-session churn
  - reconnect after transient socket loss

### 5. Extend classroom collaboration tests to catch production overwrite/desync failures

Status: ready

Problem:
- The existing smoke suite covers some churn and duplicate-user cases, but it
  did not fail before this classroom incident.
- We need issue-level work focused on the test gap itself, not just the runtime
  fix.

Evidence:
- Existing scenarios already include duplicate-user and browser-error hooks:
  - `scripts/playwright-local-group-smoke.mjs:40`
  - `scripts/playwright-local-group-smoke.mjs:1299`
  - `scripts/playwright-local-group-smoke.mjs:1302`
  - `scripts/playwright-local-group-smoke.mjs:1910`
- Production still showed duplicate sessions inside shared rooms:
  - `exported-logs/prod-20260313-183253/ws-server.log:158`
  - `exported-logs/prod-20260313-183253/all-services.log:13762`

Acceptance criteria:
- Add a classroom-grade scenario that fails on overwritten edits, not just on
  obvious disconnects.
- Add assertions on final editor contents for every participant, not only
  server-side instance state.
- Run at least one Chromium + Firefox matrix variant in CI or pre-release
  validation.
- Preserve artifacts needed for debugging: browser console, page crashes,
  websocket events, and final shared state snapshots.

## Investigate / Instrument First

### 6. Investigate Firefox-specific crashes and likely memory pressure

Status: investigate

Problem:
- A user reported that Firefox caused the whole computer to crash.
- The current production logs do not contain enough browser or memory telemetry
  to confirm root cause.

What evidence exists:
- No direct production log line ties a crash to Firefox, memory exhaustion, or
  garbage collection.
- The codebase already contains a Firefox/Zen-specific GPU cleanup workaround,
  which is a real signal that this area has browser-specific memory behavior:
  - `components/ArtBoards/ModelBoard/Diff/Diff.tsx:42`
  - `components/ArtBoards/ModelBoard/Diff/Diff.tsx:43`

Acceptance criteria:
- Capture browser, engine, and page-crash telemetry from clients.
- Capture memory-adjacent signals where available: page crashes, long tasks,
  repeated canvas/object URL creation, repeated artboard rerenders.
- Reproduce on Firefox with a realistic classroom workload.
- Identify one concrete leak or pressure source before attempting a fix issue.

### 7. Add browser / engine visibility for group members and log it for debugging

Status: investigate

Problem:
- Users reported browser-specific interpretation differences, but current logs
  do not tell us which browser or engine each participant used.
- Group members also cannot see that they are on mixed engines.

Evidence:
- WS join state currently records only `clientId`, `userId`, `userEmail`,
  `userName`, and `userImage`; it does not store browser metadata:
  - `ws-server/server.mjs:1108`
  - `ws-server/server.mjs:1144`
- The production room snapshots similarly show only identity fields and
  `clientId`, not browser/engine information:
  - `exported-logs/prod-20260313-183253/ws-server.log:154`
  - `exported-logs/prod-20260313-183253/ws-server.log:158`

Acceptance criteria:
- Capture browser family, version, and engine at join time.
- Show browser/engine badges in the multiplayer presence UI.
- Log browser/engine in room snapshots and error telemetry.
- Add a visible warning when a room has mixed engines or unsupported browsers.
