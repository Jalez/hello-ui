# Playwright Test Status

Last updated: 2026-03-18

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
