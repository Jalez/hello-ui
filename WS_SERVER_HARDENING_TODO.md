# WS Server Hardening TODO

## Objective

Bring the websocket server closer to production-grade collaboration infrastructure by:

- closing current operational gaps around connection lifecycle, latency under load, and memory pressure
- reducing custom protocol and session code where established libraries can own the problem better
- making the service easier to scale, observe, and validate

This document is based on the current codebase, not external documentation. Source references below point to the files that motivated each item.

## Current Assessment

- `Latency`: good single-node foundation, but custom JSON + base64 Yjs transport still adds overhead. Compression remains configurable and currently defaults to enabled. Sources: `ws-server/yjs-room-state.mjs`, `ws-server/server.mjs`, `ws-server/ws-config.mjs`
- `Concurrency`: materially improved. Slow-consumer disconnects, buffered-amount tracking, and transport stats now exist. Sources: `ws-server/room-membership.mjs`, `ws-server/ws-transport-stats.mjs`, `ws-server/http-routes.mjs`
- `Connection management`: materially improved. Heartbeat/liveness and authenticated reconnect admission are in place. Sources: `ws-server/socket-liveness.mjs`, `ws-server/socket-handlers/session.mjs`, `app/api/collaboration/ws-token/route.ts`
- `Scalability`: still weak because room state, awareness, hashes, and Y.Docs remain process-local. Sources: `ws-server/server.mjs`, `ws-server/yjs-room-state.mjs`
- `Resource usage`: improved, but still limited by in-process room state and the custom Yjs transport path. Sources: `ws-server/room-membership.mjs`, `ws-server/room-state-service.mjs`, `ws-server/yjs-room-state.mjs`

## Priority 0

### 1. Add heartbeat, liveness, and dead-socket termination

Status:

- `Done`

What changed:

- server-side ping/pong liveness monitor added
- dead sockets are terminated after missed pongs
- heartbeat interval is configurable

Sources:

- `ws-server/socket-liveness.mjs`
- `ws-server/socket-liveness.test.mjs`
- `ws-server/server.mjs`

### 2. Add outbound backpressure and slow-consumer protection

Status:

- `Done for current single-node scope`

What changed:

- slow consumers are disconnected when `bufferedAmount` crosses a configurable limit
- transport stats now track slow-consumer disconnects, blocked sends, send failures, invalid inbound traffic, unknown inbound traffic, and peak buffered bytes
- stats are exposed through `GET /admin/ws-stats`
- websocket compression is now configurable through `WS_PERMESSAGE_DEFLATE`

Open follow-up:

- this is still lightweight in-process observability, not a full metrics pipeline

Sources:

- `ws-server/room-membership.mjs`
- `ws-server/ws-transport-stats.mjs`
- `ws-server/http-routes.mjs`
- `ws-server/ws-config.mjs`
- `ws-server/server.mjs`

### 3. Add schema validation for all inbound websocket messages

Status:

- `Done for all current handler-backed and client-emitted inbound message types`

What changed:

- inbound payload schemas are centralized in an explicit registry
- router-level validation returns consistent protocol errors for malformed known messages
- unknown inbound message types remain non-fatal for forward compatibility, but are counted and rate-limited in logs
- parity tests now enforce:
  - every registered inbound handler type is schema-covered
  - every current client-emitted inbound message type is schema-covered

Chosen policy:

- unknown inbound messages stay ignorable, but observable

Sources:

- `ws-server/ws-protocol-schema.mjs`
- `ws-server/socket-router.mjs`
- `ws-server/ws-protocol-schema.test.mjs`
- `ws-server/socket-router.test.mjs`
- `lib/collaboration/hooks/useCollaborationConnection.ts`

### 4. Tighten websocket auth and identity verification

Status:

- `Done at the core auth boundary`

What changed:

- the app issues short-lived room-scoped ws tokens
- websocket join verifies those tokens server-side
- room identity is now server-attested instead of client-declared

Sources:

- `app/api/collaboration/ws-token/route.ts`
- `ws-server/ws-auth-token.mjs`
- `ws-server/socket-handlers/session.mjs`
- `lib/collaboration/hooks/useCollaborationConnection.ts`

## Priority 0 Measurement Notes

Measured on March 19, 2026:

- `WS_PERMESSAGE_DEFLATE=true`
  - `npm run pw:classroom-churn` passed
  - `npm run pw:latency` passed
- `WS_PERMESSAGE_DEFLATE=false`
  - `npm run pw:classroom-churn` passed
  - first `npm run pw:latency` run failed with a late-open editor readiness timeout
  - second `npm run pw:latency` rerun passed

Current decision:

- keep `WS_PERMESSAGE_DEFLATE=true` as the default
- there is no clear measured win for disabling compression
- the one failing `false` latency run is enough to treat “disable by default” as unjustified for now

## Priority 1

### 5. Replace custom Yjs transport glue with a more standard server/provider stack

Why:

- the current implementation still hand-rolls Yjs transport framing, handshake readiness, dedupe windows, and awareness relaying
- this remains the largest chunk of bespoke realtime protocol code to own long term

Actions:

- evaluate `@hocuspocus/server` first
- alternatively evaluate adopting the standard `y-websocket` server/provider path
- keep custom app events on raw `ws` only if necessary
- reduce or remove JSON + base64 wrapping for Yjs traffic if the transport remains custom

Sources:

- `ws-server/yjs-room-state.mjs`
- `ws-server/socket-handlers/yjs.mjs`
- `ws-server/package.json`

### 6. Define a real horizontal scaling story

Why:

- room membership, editor state, Y.Docs, awareness, client hashes, divergence state, and transport stats are all held in process memory
- that makes the server effectively single-instance today

Actions:

- decide whether multi-node support is required
- if yes, choose one of:
- sticky sessions plus externalized room coordination
- Redis-backed pub/sub and shared awareness/state coordination
- Hocuspocus or equivalent with a documented scaling model
- document the deployment expectation if the answer remains single-node

Sources:

- `ws-server/server.mjs`
- `ws-server/yjs-room-state.mjs`
- `ws-server/ws-transport-stats.mjs`

### 7. Improve observability: structured logs, readiness, and metrics

Why:

- the service now has basic authenticated transport stats, but still relies heavily on `console.*`
- it still lacks readiness, durable metrics, and structured event output

Actions:

- replace ad hoc logging with structured logging, likely `pino`
- add readiness separate from liveness
- publish metrics for active sockets, active rooms, reconnects, flush retries, divergence events, and slow consumers
- make shutdown logs and admin actions machine-readable

Sources:

- `ws-server/http-routes.mjs`
- `ws-server/server.mjs`
- `ws-server/room-state-service.mjs`
- `ws-server/socket-handlers/yjs.mjs`

## Priority 2

### 8. Reduce noisy or debug-only hot-path logging

Why:

- the worst stray debug log is gone, but the broader server still emits a lot of hot-path console output
- this is now more of an observability hygiene issue than a correctness issue

Actions:

- downgrade repeated hot-path logs behind log levels or sampling
- preserve high-value lifecycle and error logs only

Sources:

- `ws-server/server.mjs`
- `ws-server/room-state-service.mjs`
- `ws-server/socket-handlers/progress.mjs`
- `ws-server/socket-handlers/yjs.mjs`

### 9. Revisit persistence coupling and recovery semantics

Why:

- persistence debounce and regression guards are solid, but recovery and persistence policy are still tightly coupled to room runtime state
- this is maintainability risk more than immediate outage risk

Actions:

- separate room persistence policy from room runtime state
- define explicit retry/backoff policy for failed saves
- add tests around recovery after repeated transient DB failures

Sources:

- `ws-server/room-state-service.mjs`
- `ws-server/room-state-service.test.mjs`

### 10. Add documented capacity targets and load testing

Why:

- the Playwright coverage is strong for behavior and recovery
- it is not the same as proving connection-count capacity, latency percentiles, or memory ceilings

Actions:

- define target room sizes, socket counts, and acceptable latency budgets
- add repeatable load tests for connection churn, fanout, and sustained typing
- capture CPU and memory profiles under representative load

Sources:

- `PLAYWRIGHT_TEST_TODO.md`
- `ws-server/room-membership.mjs`
- `ws-server/yjs-room-state.mjs`

## Suggested Execution Order

1. evaluate whether to keep the custom Yjs transport or move to a standard server/provider
2. design the scaling model around that transport choice
3. then add structured observability and capacity targets around the chosen architecture

## Notes

- Priority 0 is effectively closed for the current single-node architecture.
- The next major decision is architectural, not incremental: whether to keep owning the custom Yjs transport layer.
