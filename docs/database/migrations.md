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

## Legacy SQL Files

Loose SQL files under `supabase/` are reference material from earlier setup work. The existing [Supabase migration guide](../../supabase/MIGRATIONS.md) says not to add new feature SQL as loose files.

## Migration Safety

- Never use production credentials in docs.
- Do not drop user data without a rollback and retention plan.
- Keep policy changes close to the table or feature they protect.
- Add comments for cleanup jobs and temporary data tables.
