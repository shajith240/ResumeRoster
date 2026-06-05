# Linted Supabase Migrations

`supabase/migrations/` is the database source of truth for Linted. Database schema changes must be captured as ordered migration files, not loose SQL scripts under `supabase/`.

## Files

```text
0001_core_schema_auth_storage.sql
0002_resume_context_reads_presence.sql
0003_roast_threads_reactions_deletes.sql
0004_profiles_avatars_public_profile.sql
0005_leaderboard_auth_lookup.sql
0006_rls_storage_hardening.sql
0007_content_reporting_moderation.sql
0008_saved_resumes.sql
0009_resume_privacy_modes.sql
0010_admin_stickers_moderation.sql
0011_comment_media_markdown.sql
0012_comment_images_only.sql
0013_reviewer_community_layer.sql
0014_linted_profile_defaults.sql
0015_role_onboarding.sql
0016_fix_onboarding_rpc_ambiguity.sql
0017_single_active_user_sessions.sql
0018_map_onboarding_persona_to_profile_role.sql
0019_realtime_notifications.sql
0020_security_reliability_hardening.sql
0021_revert_security_reliability_hardening.sql
0022_lint_points_helpful_votes.sql
0023_profile_reports_admin_controls.sql
0024_admin_user_lifecycle.sql
0025_linted_naming_compatibility.sql
0026_data_integrity_guardrails.sql
0027_review_query_hygiene.sql
0028_authenticated_write_rate_limits.sql
0029_saved_resumes_api_contract.sql
0030_rate_limit_pgcrypto_schema.sql
0031_notifications_delete_policy.sql
0032_web_push_subscriptions.sql
0033_privacy_first_profile_defaults.sql
0034_allow_admin_delete_cascades.sql
0035_admin_inbox_messages.sql
0036_refine_linted_usernames.sql
0037_admin_delete_user_transaction.sql
0038_remove_auth_email_lookup.sql
0039_transactional_admin_messages.sql
0040_scheduled_temporary_data_cleanup.sql
0041_admin_user_search_rpc.sql
0042_transactional_admin_moderation_actions.sql
0043_transactional_reviewer_application_submit.sql
0044_upload_security_quarantine.sql
0045_authenticated_api_rate_limits.sql
0046_health_readiness_checks.sql
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

## SQL Source Of Truth

Tracked SQL under `supabase/` is limited to:

- `supabase/migrations/*.sql`
- `supabase/seed.sql` if seed data is needed

Run the guard before opening a PR:

```bash
npm run db:check
```

CI also runs this check so legacy one-off SQL cannot drift back into the active Supabase tree.

## Duplicate SQL History

Applied migrations are append-only production history. Do not edit, reorder, or
deduplicate old migration files only to reduce jscpd percentages.

The active duplicate-code report excludes `supabase/migrations/**` so SQL clone
cleanup does not encourage unsafe history rewrites. Historical duplication is
still generated in `docs/generated/quality/migration-history-jscpd-report.md`
as an audit aid.

If the migration chain becomes too long to operate comfortably, plan a migration
squash or bootstrap migration as a coordinated database operation. Validate it
against a fresh local database and a linked staging project before changing the
production workflow.
