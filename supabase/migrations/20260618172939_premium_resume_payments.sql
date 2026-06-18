-- Premium resume payments: Razorpay ₹199 priority review flow.
-- Adds columns, constraints, indexes, and service-role RPCs.

-- New columns on resumes.
alter table public.resumes
  add column if not exists is_premium            boolean   not null default false,
  add column if not exists payment_status        text,
  add column if not exists payment_id            text,
  add column if not exists razorpay_order_id     text,
  add column if not exists assigned_reviewer_id  uuid references public.profiles (id) on delete set null,
  add column if not exists review_deadline       timestamptz,
  add column if not exists premium_claimed_at    timestamptz;

-- Domain constraint: only valid statuses, null allowed for free resumes.
alter table public.resumes
  add constraint resumes_payment_status_check
    check (
      payment_status is null or
      payment_status = any (array['pending', 'paid', 'refunded', 'failed'])
    );

-- Idempotency guards: one resume per order, one resume per payment capture.
alter table public.resumes
  add constraint resumes_razorpay_order_id_key unique (razorpay_order_id);

alter table public.resumes
  add constraint resumes_payment_id_key unique (payment_id);

-- Fast lookup for idempotency check in the verify route.
create index if not exists resumes_razorpay_order_id_idx
  on public.resumes (razorpay_order_id)
  where razorpay_order_id is not null;

-- Feed/dashboard filter: unclaimed paid premium resumes ordered newest-first.
create index if not exists resumes_premium_claimable_idx
  on public.resumes (created_at desc)
  where is_premium = true
    and payment_status = 'paid'
    and assigned_reviewer_id is null
    and status = 'open';

-- Reviewer dashboard: active claims with deadline.
create index if not exists resumes_assigned_reviewer_active_idx
  on public.resumes (assigned_reviewer_id, review_deadline)
  where assigned_reviewer_id is not null
    and payment_status = 'paid'
    and status = 'open';

-- ---------------------------------------------------------------------------
-- create_premium_resume: inserts a resume row after HMAC verification.
-- Caller: /api/payments/verify (service_role). Amount never touches this fn.
-- ---------------------------------------------------------------------------
create or replace function public.create_premium_resume(
  target_user_id          uuid,
  resume_title            text,
  resume_file_path        text,
  resume_is_anonymous     boolean,
  resume_privacy_mode     text,
  resume_job_description  text,
  resume_post_description text,
  p_payment_id            text,
  p_razorpay_order_id     text
)
returns table (id uuid)
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'create_premium_resume requires the service role.';
  end if;

  return query
  insert into public.resumes (
    file_path,
    is_anonymous,
    is_premium,
    job_description,
    payment_id,
    payment_status,
    post_description,
    privacy_mode,
    razorpay_order_id,
    review_queue_status,
    title,
    user_id,
    activation_reviews_required,
    activation_reviews_completed
  )
  values (
    resume_file_path,
    resume_is_anonymous,
    true,
    resume_job_description,
    p_payment_id,
    'pending',
    resume_post_description,
    resume_privacy_mode,
    p_razorpay_order_id,
    'active',
    resume_title,
    target_user_id,
    0,
    0
  )
  returning resumes.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_premium_resume: atomic reviewer assignment.
-- WHERE clause is the lock — no separate locking needed.
-- ---------------------------------------------------------------------------
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
  v_count int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'claim_premium_resume requires the service role.';
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

-- Revoke public execute; only service_role may call these.
revoke execute on function public.create_premium_resume(uuid, text, text, boolean, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.claim_premium_resume(uuid, uuid) from public, anon, authenticated;
