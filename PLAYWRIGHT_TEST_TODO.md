# Playwright Test Status

Last updated: 2026-03-18

## How To Run

Run from repo root.

Start app:
- `npm run dev`

Start ws server:
- `PORT=3100 node ws-server/server.mjs`

Recommended collaboration checks:
- `npm run pw:local-group`
- `npm run pw:classroom-churn`
- `npm run pw:same-user`
- `npm run pw:same-user-blocked`
- `npm run pw:refresh-desync`
- `npm run pw:latency`
- `npm run pw:text-production`
- `npm run pw:text-production-hard`
- `PLAYWRIGHT_ALLOW_WS_CRASH=true npm run pw:ws-recovery`
- `PLAYWRIGHT_ALLOW_WS_CRASH=true npm run pw:ws-recovery-harsh`

Optional ws-server verification:
- `npx tsc --noEmit --pretty false`
- `node --test ws-server/ws-config.test.mjs ws-server/ws-transport-stats.test.mjs ws-server/http-routes.test.mjs ws-server/socket-liveness.test.mjs ws-server/room-membership.test.mjs ws-server/room-state-service.test.mjs ws-server/socket-handlers/progress.test.mjs ws-server/socket-handlers/session.test.mjs ws-server/socket-router.test.mjs ws-server/ws-auth-token.test.mjs ws-server/ws-protocol-schema.test.mjs ws-server/ws-runtime-context.test.mjs`

Run notes:
- Ensure only one ws server is listening on `3100`.
- Restart both servers before retrying a suspicious failure.
- `pw:ws-recovery*` starts its own isolated managed ws server internally.
- `pw:creator-level-sync` is not available on the current `ui-designer` branch.

## Passed

- [x] `pw:local-group`
- [x] `pw:classroom-churn`
- [x] `pw:text-production`
- [x] `pw:text-production-hard`
- [x] `pw:in-game-churn`
- [x] `pw:same-user`
- [x] `pw:same-user-blocked`
- [x] `pw:duplicate-churn`
- [x] `pw:refresh-desync`
- [x] `pw:in-game-duplicate`
- [x] `pw:ws-invalid-frame` with `PLAYWRIGHT_ALLOW_WS_CRASH=true`
- [x] `pw:latency`
- [x] `pw:ws-recovery`
- [x] `pw:ws-recovery-hard`

## Not Yet Run

- [ ] `pw:ws-recovery-harsh`
- [ ] `pw:ws-recovery-extreme`
- [ ] `pw:ai-generation`
- [ ] `pw:prod-replay`

## Setup Only

- [ ] `pw:install`

## Notes

- `pw:ws-recovery` passed after updating the smoke harness to use CodeMirror's view API for cursor placement and content reads.
- `pw:ws-invalid-frame` requires `PLAYWRIGHT_ALLOW_WS_CRASH=true` to run instead of exiting on its safety guard.
- No Playwright test is currently marked as failing in this file. If a future run fails, move it into a separate failed section with the date and a short note.
