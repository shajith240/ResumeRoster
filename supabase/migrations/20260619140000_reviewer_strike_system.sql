-- Reviewer strike system.
-- Each missed deadline increments reviewer_missed_count.
-- At 3 misses, reviewer_claim_suspended is set true —
-- blocking future claims without removing verified status.

alter table public.profiles
  add column if not exists reviewer_missed_count integer not null default 0
    check (reviewer_missed_count >= 0),
  add column if not exists reviewer_claim_suspended boolean not null default false;

-- Re-create claim_premium_resume to reject suspended reviewers.
create or replace function public.claim_premium_resume(
  p_resume_id   uuid,
  p_reviewer_id uuid
)
returns table (claimed boolean, reason text)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_count    int;
  v_suspended boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'claim_premium_resume requires the service role.';
  end if;

  -- Check suspension before touching resumes.
  select reviewer_claim_suspended
    into v_suspended
    from public.profiles
   where id = p_reviewer_id;

  if v_suspended is true then
    return query select false,
      'Your claiming ability is suspended due to missed review deadlines. Contact support to appeal.'::text;
    return;
  end if;

  update public.resumes
  set
    assigned_reviewer_id = p_reviewer_id,
    review_deadline      = now() + interval '24 hours',
    premium_claimed_at   = now()
  where id                    = p_resume_id
    and is_premium             = true
    and payment_status         = 'paid'
    and assigned_reviewer_id   is null
    and status                 = 'open'
    and user_id               <> p_reviewer_id;

  get diagnostics v_count = row_count;

  if v_count > 0 then
    return query select true, ''::text;
  else
    return query select false,
      'This resume is already claimed, not available for review, or you are the author.'::text;
  end if;
end;
$$;

revoke execute on function public.claim_premium_resume(uuid, uuid) from public, anon, authenticated;
