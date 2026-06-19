-- Tracks earnings owed to reviewers for completed priority reviews.
-- One row per completed premium review. Status: pending → paid.
-- Amount stored in paise (₹99 = 9900 paise per review).

create table if not exists public.reviewer_payouts (
  id          uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  resume_id   uuid references public.resumes(id) on delete set null,
  amount_paise integer not null default 9900 check (amount_paise >= 0),
  status      text not null default 'pending'
                check (status in ('pending', 'paid')),
  payout_ref  text,
  paid_by     uuid references public.profiles(id) on delete set null,
  paid_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- One payout per completed (resume, reviewer) pair.
create unique index if not exists reviewer_payouts_resume_reviewer_idx
  on public.reviewer_payouts (resume_id, reviewer_id)
  where resume_id is not null;

-- Fast lookup by reviewer for the payout queue.
create index if not exists reviewer_payouts_reviewer_status_idx
  on public.reviewer_payouts (reviewer_id, status);

-- No public RLS — all access via service_role API only.
alter table public.reviewer_payouts enable row level security;
-- (no policies: service_role bypasses RLS by default)
