# Migrations

Migrations are ordered SQL files under `supabase/migrations/`.

## Workflow

1. Create a new migration with the next number.
2. Make the SQL idempotent where practical.
3. Keep destructive changes separate and clearly named.
4. Run local reset or dry-run validation.
5. Update docs for schema, RLS, RPC, or cleanup policy changes.

## Current Shape

The repo has migrations from `0001_core_schema_auth_storage.sql` through the latest migration shown in the generated source atlas. These include core schema, storage hardening, privacy modes, admin controls, notifications, rate limits, push subscriptions, cascade behavior, admin inbox messages, and username refinement.

## SQL Source Of Truth

Tracked SQL under `supabase/` must live in `supabase/migrations/`, except for `supabase/seed.sql` if seed data is needed. The existing [Supabase migration guide](../../supabase/MIGRATIONS.md) documents this rule, and CI enforces it with `npm run db:check`.

## Migration Safety

- Never use production credentials in docs.
- Do not drop user data without a rollback and retention plan.
- Keep policy changes close to the table or feature they protect.
- Add comments for cleanup jobs and temporary data tables.
