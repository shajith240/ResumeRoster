-- Linted: expire_claimed_premium_resumes RPC
-- Atomically finds claimed premium resumes where the reviewer missed their 24h
-- deadline (no roast posted), un-assigns the reviewer, and returns the affected
-- rows so the cron can issue Razorpay refunds.

create or replace function public.expire_claimed_premium_resumes()
returns table (
  resume_id       uuid,
  payment_id      text,
  old_reviewer_id uuid,
  candidate_id    uuid
)
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'expire_claimed_premium_resumes requires the service role.';
  end if;

  -- CTE selects expired claims with a row-level lock (skip already-locked rows
  -- so two simultaneous cron fires don't double-process).
  return query
  with expired as (
    select
      r.id                   as resume_id,
      r.payment_id           as payment_id,
      r.assigned_reviewer_id as old_reviewer_id,
      r.user_id              as candidate_id
    from public.resumes r
    where r.is_premium             = true
      and r.payment_status         = 'paid'
      and r.assigned_reviewer_id   is not null
      and r.review_deadline        < now()
      and not exists (
        select 1
        from public.roasts ro
        where ro.resume_id  = r.id
          and ro.author_id  = r.assigned_reviewer_id
          and ro.is_deleted = false
      )
    for update skip locked
  ),
  updated as (
    update public.resumes r
    set
      assigned_reviewer_id = null,
      review_deadline      = null,
      premium_claimed_at   = null,
      payment_status       = 'refunded'
    from expired e
    where r.id = e.resume_id
    returning
      r.id        as resume_id,
      e.payment_id,
      e.old_reviewer_id,
      r.user_id   as candidate_id
  )
  select u.resume_id, u.payment_id, u.old_reviewer_id, u.candidate_id
  from updated u;
end;
$$;

revoke all on function public.expire_claimed_premium_resumes()
  from public, anon, authenticated;
grant execute on function public.expire_claimed_premium_resumes()
  to service_role;

comment on function public.expire_claimed_premium_resumes() is
  'Service-role cron helper: un-assigns reviewers who missed their 24h deadline
   and returns affected rows for Razorpay refund processing.';

notify pgrst, 'reload schema';
