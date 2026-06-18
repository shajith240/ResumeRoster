# Data Retention

This page records the database cleanup policy for temporary and high-growth
tables. User content is not automatically deleted unless a policy is explicit.

## Scheduled Cleanup

Migration `0040_scheduled_temporary_data_cleanup.sql` enables Supabase Cron and
schedules `linted-temporary-data-cleanup` every 5 minutes. The job runs
`public.run_temporary_data_cleanup()` inside Postgres.

| Data Type | Retention | Cleanup |
| --- | --- | --- |
| Presence rows | Keep only recent heartbeats. | Delete `app_presence_sessions` rows with `last_seen_at` older than 5 minutes. |
| Active session locks | Keep current locks and a short grace window. | Delete `active_user_sessions` rows with `expires_at` older than 10 minutes. |
| Rate-limit rows | Keep recent abuse-protection counters. | Delete `request_rate_limits` rows with `updated_at` older than 7 days. |
| Cron run history | Keep recent operational history. | Delete `cron.job_run_details` rows with `start_time` older than 14 days. |

The older opportunistic cleanup inside presence and rate-limit RPCs remains as a
backstop, but the scheduled job is the primary cleanup path.

## Not Automatically Purged

| Data Type | Current Policy |
| --- | --- |
| Notifications | Retained until a user deletes them or a future notification retention policy is approved. |
| Resume files and rows | Retained until resume deletion, account deletion, user request, or a specific moderation/legal workflow. |
| Comment media and attachment metadata | Retained while linked to comments. Unclaimed uploads can be deleted by the owning user through `delete_unclaimed_comment_attachment`; account deletion removes owned comment media paths after the database transaction commits. |
| Admin audit logs | Retained for accountability and moderation history. |

## Operations

Supabase Cron stores jobs in `cron.job` and run history in
`cron.job_run_details`. To inspect this cleanup job:

```sql
select schedule, jobname, command, active
from cron.job
where jobname = 'linted-temporary-data-cleanup';
```

```sql
select status, start_time, end_time, return_message
from cron.job_run_details
where jobid in (
  select jobid
  from cron.job
  where jobname = 'linted-temporary-data-cleanup'
)
order by start_time desc
limit 20;
```
