-- Structured premium review submissions.
-- When a verified reviewer submits feedback on a premium resume, the 5-field
-- structured review is stored here alongside the visible roast thread entry.
-- One submission per (resume, reviewer) pair enforced by unique constraint.

create table public.premium_reviews (
  id                  uuid        primary key default gen_random_uuid(),
  resume_id           uuid        not null references public.resumes(id) on delete cascade,
  roast_id            uuid        references public.roasts(id) on delete set null,
  reviewer_id         uuid        not null references public.profiles(id) on delete cascade,
  overall_rating      integer     not null check (overall_rating between 1 and 5),
  overall_impression  text        not null check (char_length(overall_impression) between 20 and 2000),
  clarity_feedback    text        not null check (char_length(clarity_feedback) between 10 and 2000),
  impact_feedback     text        not null check (char_length(impact_feedback) between 10 and 2000),
  skills_gap          text        not null check (char_length(skills_gap) between 10 and 2000),
  top_changes         text        not null check (char_length(top_changes) between 10 and 2000),
  created_at          timestamptz not null default now(),

  unique (resume_id, reviewer_id)
);

-- RLS: owner and assigned reviewer can read their own premium review data.
-- Admin can read all (via service_role).
alter table public.premium_reviews enable row level security;

create policy "premium_reviews_select_own"
  on public.premium_reviews
  for select
  using (
    reviewer_id = auth.uid() or
    exists (
      select 1 from public.resumes r
      where r.id = premium_reviews.resume_id
        and r.user_id = auth.uid()
    )
  );

-- No public insert/update/delete — submissions go through the API route
-- using the service role client.
create policy "premium_reviews_no_direct_write"
  on public.premium_reviews
  for all
  using (false)
  with check (false);

-- Fast lookup by resume_id for the detail page.
create index premium_reviews_resume_id_idx on public.premium_reviews (resume_id);

notify pgrst, 'reload schema';
