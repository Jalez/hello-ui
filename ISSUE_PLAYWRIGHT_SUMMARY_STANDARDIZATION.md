# Issue: Standardize Playwright End-of-Run Summaries

## Problem

The Playwright scripts do not all end with equally good summaries.

Some scenarios already print a clear end-state summary with:

- scenario name
- overall status
- per-group or per-check results
- useful run parameters

Others rely too much on streamed logs and implicit process exit status, which makes failures slower to interpret and makes it harder to compare runs.

## Goal

Make every Playwright scenario print a clear, consistent end-of-run summary.

Minimum summary contract:

- scenario name
- overall result: `PASS` / `FAIL`
- per-group or per-check result lines where applicable
- explicit failure reason when the run fails
- key scenario parameters when relevant
  - restart delay
  - harshness / latency flags
  - extra reload or stability verification toggles

## Likely scope

Primary file:

- [playwright-local-group-smoke.mjs](/Users/jaakkorajala/Projects/ai_tools/sharing/css_artist/scripts/playwright-local-group-smoke.mjs)

Likely work:

- normalize the final reporting path for every supported `PLAYWRIGHT_SCENARIO`
- ensure non-zero exits still print a short failure summary before exiting
- avoid relying on ad hoc `console.log` streams as the only source of truth
- keep current rich scenario-specific details where useful, but make the final block consistent

## Why this matters

- faster debugging when a run fails
- easier CI/local reading
- clearer handoff between humans and models
- better confidence that “green” and “red” mean the same thing across scenarios

## Acceptance criteria

- every Playwright scenario has a recognizable end summary block
- failure runs print a concise failure summary before exit
- recovery variants include their key runtime settings in the summary
- summary formatting is consistent enough that another tool or person can scan it quickly

## Suggested verification

Run at least:

- `npm run pw:local-group`
- `npm run pw:classroom-churn`
- `npm run pw:latency`
- `PLAYWRIGHT_ALLOW_WS_CRASH=true npm run pw:ws-recovery`
- `PLAYWRIGHT_ALLOW_WS_CRASH=true npm run pw:ws-recovery-harsh`
- `npm run pw:text-production`

## Notes

- This is a reporting/maintainability improvement, not a transport/runtime behavior change.
- Be careful not to break existing scenario logic while refactoring summary output.
