# Collaboration Persistence / Desync Todo

Last updated: 2026-03-14

## Problem

Group room code is still sometimes persisted in a truncated or empty state after
refresh / reconnect churn. The save itself succeeds, but it saves the wrong
snapshot.

This means the primary bug is not "DB save failed" but:

1. the canonical in-memory room state becomes wrong first
2. that wrong state is marked dirty
3. the WS server later persists it successfully

## What The Logs Show

Evidence from [testlogs.txt](/Users/jaakkorajala/Projects/ai_tools/sharing/css_artist/testlogs.txt):

- The room is actively receiving Yjs sync traffic while divergence is reported.
- The last-user disconnect path does run.
- The backend save does run and returns success.
- The persisted snapshot is already bad at save time.

Example signals seen in the logs:

- repeated `divergence:transient`
- repeated `yjs-protocol:recv ... channel=sync messageType=2`
- `[room-empty] ... trigger=last-user-left`
- `PATCH /api/games/.../instance ... 200`
- `[db-save:ok]`

With the added persistence logging, the saved payload itself showed:

- `Exercise 1 htmlLength=0`
- `Exercise 2 htmlLength=24`

So the server was not skipping persistence. It was persisting already-corrupted
room state.

## What Was Tried

### 1. Extra persistence logging

Files:

- [server.mjs](/Users/jaakkorajala/Projects/ai_tools/sharing/css_artist/ws-server/server.mjs)
- [room-membership.mjs](/Users/jaakkorajala/Projects/ai_tools/sharing/css_artist/ws-server/room-membership.mjs)

Added logs for:

- when a room becomes dirty
- when a flush starts
- when a flush succeeds / retries / drops
- when the last user leaves a room
- per-level code lengths and hashes being saved

Result:

- useful
- confirmed the save was happening
- confirmed the saved snapshot was already bad
- did not fix the underlying bug

### 2. Refresh / reconnect Yjs handshake hardening

Files:

- [session.mjs](/Users/jaakkorajala/Projects/ai_tools/sharing/css_artist/ws-server/socket-handlers/session.mjs)
- [CollaborationProvider.tsx](/Users/jaakkorajala/Projects/ai_tools/sharing/css_artist/lib/collaboration/CollaborationProvider.tsx)
- [playwright-local-group-smoke.mjs](/Users/jaakkorajala/Projects/ai_tools/sharing/css_artist/scripts/playwright-local-group-smoke.mjs)

Changes attempted:

- send server sync step 2 snapshot immediately on join
- then send sync step 1 handshake
- avoid treating sync step 1 alone as fully ready on client
- add a dedicated `refresh_desync` Playwright scenario

Result:

- improved one class of reload failure
- proved some refresh/reconnect cases
- did not eliminate the production-like failure

### 3. Divergence-triggered local Y.Doc replacement

File:

- [CollaborationProvider.tsx](/Users/jaakkorajala/Projects/ai_tools/sharing/css_artist/lib/collaboration/CollaborationProvider.tsx)

Changes attempted:

- after divergence retry, if no inbound remote update arrives in time, replace
  the local Y.Doc and re-run sync

Result:

- sensible recovery hardening
- not sufficient to stop this persistence bug

### 4. Persistence guard fallback to previous saved snapshot

File:

- [server.mjs](/Users/jaakkorajala/Projects/ai_tools/sharing/css_artist/ws-server/server.mjs)

Changes attempted:

- keep last saved snapshot per room
- if the room is divergent and the next snapshot regresses badly, save the
  previous snapshot instead

Result:

- did not solve the reported failure
- reason: in failing runs, the first known saved snapshot was already bad, so
  there was no previous good snapshot to fall back to

### 5. Save-timing fix: debounce flush until room is quiet

Files:

- [server.mjs](/Users/jaakkorajala/Projects/ai_tools/sharing/css_artist/ws-server/server.mjs)
- [room-membership.mjs](/Users/jaakkorajala/Projects/ai_tools/sharing/css_artist/ws-server/room-membership.mjs)

Changes attempted:

- change write buffering from "first dirty event starts timer" to a real
  quiet-window debounce
- every new dirty event resets the flush timer
- last-user disconnect no longer forces an immediate flush; it queues a normal
  flush respecting the quiet window
- shutdown still forces flush

Result:

- this addressed a real save-timing flaw
- user reported it still did not fix the actual incident
- conclusion: wrong state is sometimes becoming canonical even before the save
  timing matters

## Current Conclusion

The main bug is likely one of these:

1. a reconnecting / refreshed client is still able to reintroduce incomplete
   document state into the room before full canonical hydration settles
2. the room is being seeded from already-wrong loaded state
3. the server treats transient Yjs update churn as canonical room content too
   early
4. group instance routing / reload flow causes users to come back through a
   different path than the one holding the expected room state

At this point, the evidence says:

- persistence is downstream of the corruption
- the corruption must be fixed before persistence, not merely guarded during
  persistence

## Next Fix Direction

The next work should focus on room-state authority and load sequencing, not on
more DB-save tricks.

### Required next steps

1. Log room creation and room join snapshots before the Y.Doc is created.
   Specifically log:
   - loaded DB progress snapshot
   - merged template + progress snapshot
   - initial Y.Doc snapshot right after hydration

2. Detect whether a just-joined or just-reconnected client can publish updates
   before it has received the full canonical room state.

3. Add a guard in the Yjs server path so that reconnect churn cannot replace a
   room's canonical content with a clearly regressed / empty snapshot during
   hydration.

4. Add a failing automated scenario that proves:
   - one user refreshes during active typing
   - another user continues typing
   - all users leave
   - persisted group instance is verified after re-entry

5. Verify whether LTI routing is putting users back into the same `group:` room
   or sending them into `lobby:` / no-group flow in the failing cases.

## Short Version

What was tried:

- better logging
- Yjs handshake hardening
- local divergence recovery
- previous-snapshot persistence guard
- quiet-window save debounce

What happened:

- none of those fixed the actual corruption incident

What that means:

- the save is not the real source of truth problem
- the room state becomes wrong before persistence
- the next fix has to target canonical room hydration / reconnect authority
