# Database schema inventory (Drizzle-first migration path)

This document tracks parity between **legacy SQL bootstrap** (`scripts/sql/`, `docker/db-init-docker.mjs`), **Drizzle schema** (`lib/db/schema/`), and **versioned migrations** (`lib/db/migrations/`).

## Supported workflow

1. **Create DB** (if needed): `pnpm db:create-database`
2. **Legacy bootstrap** (Docker / local): SQL init creates the bulk of tables (until a full baseline migration exists).
3. **Apply migrations**: `pnpm db:migrate` — **required** after init for columns/tables owned by Drizzle migrations (e.g. `projects.group_id`, `lti_credentials`, drawboard runtime columns).
4. **Verify** (optional): `pnpm db:verify-schema` and `pnpm db:check`

Production (`docker-up.sh` server path): DB init container runs SQL bootstrap; **app image runs `pnpm db:migrate`** (not `db:push`).

## Extensions

| Object | Where created | In Drizzle schema? |
|--------|----------------|-------------------|
| `pgcrypto` | `docker/db-init-docker.mjs` | No — keep minimal raw SQL / init step |

## Previously SQL-only (now in Drizzle + migrations)

| Object | Legacy SQL | Drizzle / migration |
|--------|------------|---------------------|
| `projects.drawboard_capture_mode`, `manual_drawboard_capture`, `remote_sync_debounce_ms` | `game-runtime-settings-migration.sql` | `lib/db/schema/game.ts` + `0000_game_runtime_drawboard_settings.sql` |
| `projects.group_id` + index | `group-game-migration.sql` | `lib/db/schema/game.ts` + `0001_projects_group_id_lti_credentials.sql` |
| `lti_credentials` + trigger `lti_credentials_updated_at_trigger` + `update_lti_credentials_updated_at()` | `lti-credentials-schema.sql` | `lib/db/schema/lti.ts` + `0001_projects_group_id_lti_credentials.sql` |

## Still primarily in SQL bootstrap (no Drizzle table / or partial)

These remain owned by `scripts/sql/` until folded into a baseline or raw SQL migrations:

- **Users helpers**: `get_or_create_user_id`, `get_user_email`, etc. (`users-schema.sql`)
- **Projects triggers / functions**: e.g. `update_projects_updated_at` (`projects-schema.sql`)
- **Documents stack**: `documents`, `source_files`, … (`documents-schema.sql`) — in Drizzle (`lib/db/schema/documents.ts`) but not all Docker init paths apply that SQL file; feature-dependent
- **Game statistics / collaboration** optional SQL files under `scripts/sql/`

## Duplicate ownership policy

- **Do not** add the same additive change in both a new `scripts/sql/*-migration.sql` **and** a new Drizzle migration. Prefer **one** versioned file under `lib/db/migrations/` plus schema updates in `lib/db/schema/`.
- Legacy SQL files that were superseded carry a **deprecation comment** at the top pointing to the migration.

## Fresh database (future baseline)

A **single** `drizzle migrate` on an empty database is not yet the full story: the repo still relies on SQL bootstrap for the historical table set. The goal is to converge to **extensions + migrate** only; until then, always run **`pnpm db:migrate` after SQL init**.

After migrate, run **`pnpm db:verify-migrations`** (updates `EXPECTED_MIGRATION_COUNT` in `scripts/verify-drizzle-migration-chain.ts` when you add journal entries).
