-- pg_cron job: send push notifications to reviewers approaching their deadline.
--
-- Two windows per resume:
--   • 12h warning — fires when 11.5h ≤ time_remaining < 12.5h
--   •  4h warning — fires when  3.5h ≤ time_remaining <  4.5h
--
-- Dedup: each window uses a deterministic dedupe_key so the unique index on
-- (recipient_id, dedupe_key) silently ignores a duplicate if the cron overlaps.
-- The dedupe_key is bounded to ≤ 240 chars (the column constraint).
--
-- pg_cron already has the extension enabled (see 0040_scheduled_temporary_data_cleanup.sql).
-- This runs every hour at :00. Vercel Hobby plan constraint does not apply — pg_cron
-- runs inside Supabase's Postgres, not Vercel.

-- ─── helper function ───────────────────────────────────────────────────────────

create or replace function public.send_reviewer_deadline_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_title text;
  v_body  text;
  v_key   text;
begin
  -- 12-hour warning
  for rec in
    select
      r.id          as resume_id,
      r.assigned_reviewer_id as reviewer_id
    from public.resumes r
    where
      r.is_premium              = true
      and r.payment_status      = 'paid'
      and r.status              = 'open'
      and r.assigned_reviewer_id is not null
      and r.review_deadline between now() + interval '11.5 hours'
                                    and now() + interval '12.5 hours'
  loop
    v_title := 'Priority review — 12 hours left';
    v_body  := 'Your deadline is approaching. Submit your review to avoid a miss.';
    v_key   := 'deadline_12h_' || rec.resume_id::text;

    insert into public.notifications (
      recipient_id,
      type,
      title,
      body,
      link_href,
      resume_id,
      dedupe_key
    )
    values (
      rec.reviewer_id,
      'reviewer_status',
      v_title,
      v_body,
      '/resumes/' || rec.resume_id::text,
      rec.resume_id,
      v_key
    )
    on conflict (recipient_id, dedupe_key)
    where dedupe_key is not null
    do nothing;
  end loop;

  -- 4-hour warning (urgent)
  for rec in
    select
      r.id          as resume_id,
      r.assigned_reviewer_id as reviewer_id
    from public.resumes r
    where
      r.is_premium              = true
      and r.payment_status      = 'paid'
      and r.status              = 'open'
      and r.assigned_reviewer_id is not null
      and r.review_deadline between now() + interval '3.5 hours'
                                    and now() + interval '4.5 hours'
  loop
    v_title := 'Priority review — 4 hours left';
    v_body  := 'Final reminder: submit your review in the next 4 hours or it will expire.';
    v_key   := 'deadline_4h_' || rec.resume_id::text;

    insert into public.notifications (
      recipient_id,
      type,
      title,
      body,
      link_href,
      resume_id,
      dedupe_key
    )
    values (
      rec.reviewer_id,
      'reviewer_status',
      v_title,
      v_body,
      '/resumes/' || rec.resume_id::text,
      rec.resume_id,
      v_key
    )
    on conflict (recipient_id, dedupe_key)
    where dedupe_key is not null
    do nothing;
  end loop;
end;
$$;

-- Restrict to service_role / postgres only — no public execute.
revoke all on function public.send_reviewer_deadline_reminders() from public;
revoke all on function public.send_reviewer_deadline_reminders() from anon;
revoke all on function public.send_reviewer_deadline_reminders() from authenticated;

-- ─── pg_cron schedule ──────────────────────────────────────────────────────────

-- Remove any stale job first (idempotent).
select cron.unschedule('linted-reviewer-deadline-reminders')
where exists (
  select 1 from cron.job where jobname = 'linted-reviewer-deadline-reminders'
);

-- Run at the top of every hour.
select cron.schedule(
  'linted-reviewer-deadline-reminders',
  '0 * * * *',
  $cron$select public.send_reviewer_deadline_reminders();$cron$
);
