# ResumeRoster Supabase Migrations

`supabase/migrations/` is the database source of truth for ResumeRoster. The loose SQL files in this folder are legacy one-off scripts kept as reference while the ordered migrations are validated in production and local environments.

## Files

```text
0001_core_schema_auth_storage.sql
0002_resume_context_reads_presence.sql
0003_roast_threads_reactions_deletes.sql
0004_profiles_avatars_public_profile.sql
0005_leaderboard_auth_lookup.sql
0006_rls_storage_hardening.sql
```

The migrations are written as idempotent forward migrations. They use `create table if not exists`, `alter table ... add column if not exists`, `drop policy if exists`, `drop trigger if exists`, and `create or replace function` so they can run against both an existing Supabase project and a fresh local database without truncating user data.

## Production Workflow

```bash
npm install
npx supabase login
npx supabase link --project-ref your-project-ref
npm run db:push:dry
```

Review the dry-run SQL before applying it. After review:

```bash
npm run db:push
```

Do not run `db reset` against production.

## Local Validation

If Docker is available:

```bash
npm run db:reset
```

That command rebuilds the local Supabase database from the ordered migrations. It is destructive for the local database only.

## Legacy SQL

Do not add new feature SQL as loose files. Add a new ordered migration instead. The legacy files can be moved into an archive after the migration reset and production dry-run have both been verified.
