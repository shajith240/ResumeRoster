# Data Retention

This page records the database cleanup questions that should be solved after the UI and documentation pass.

## Current Principle

Do not delete user data automatically until the policy is explicit. Cleanup jobs should be documented, reversible where possible, and aligned with privacy promises.

## Data Types To Review

| Data Type | Cleanup Question |
| --- | --- |
| Presence rows | How long should inactive session rows stay? |
| Rate-limit rows | When can old rate-limit counters be removed? |
| Notifications | Should read or deleted notifications be archived or purged? |
| Upload metadata | What remains after a resume is deleted? |
| Comment media | Should orphaned media be deleted on a schedule? |
| Admin audit logs | How long must moderation history stay? |
| Temporary auth/session data | Which tables are Supabase-managed versus app-managed? |

## Future Cleanup Plan

1. Inventory temporary and high-growth tables.
2. Define retention windows.
3. Add migration-backed cleanup functions.
4. Schedule cleanup with Supabase cron or a safe server job.
5. Add admin observability before destructive cleanup.
