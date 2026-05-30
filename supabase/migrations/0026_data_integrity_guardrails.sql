-- Linted 0026: data integrity guardrails before v1 launch.
-- Repairs derived counters from source-of-truth tables and prevents the
-- legacy is_anonymous flag from drifting away from privacy_mode.

update public.resumes
set is_anonymous = case
  when privacy_mode = 'public' then false
  else true
end
where privacy_mode in ('public', 'contact_hidden', 'anonymous')
  and is_anonymous is distinct from (privacy_mode <> 'public');

alter table public.resumes
  drop constraint if exists resumes_privacy_mode_anonymity_check;

alter table public.resumes
  add constraint resumes_privacy_mode_anonymity_check
  check (
    (
      privacy_mode = 'public'
      and is_anonymous = false
    )
    or (
      privacy_mode in ('contact_hidden', 'anonymous')
      and is_anonymous = true
    )
  );

update public.roasts
set
  helpful_votes = coalesce(vote_counts.like_count, 0),
  dislike_count = coalesce(vote_counts.dislike_count, 0)
from (
  select
    roasts.id as roast_id,
    count(votes.id) filter (where votes.reaction = 'like')::int as like_count,
    count(votes.id) filter (where votes.reaction = 'dislike')::int as dislike_count
  from public.roasts
  left join public.votes on votes.roast_id = roasts.id
  group by roasts.id
) as vote_counts
where public.roasts.id = vote_counts.roast_id
  and public.roasts.is_deleted = false;

update public.roasts
set
  helpful_votes = 0,
  dislike_count = 0
where is_deleted = true
  and (helpful_votes <> 0 or dislike_count <> 0);

update public.roasts
set reply_count = coalesce(reply_counts.total, 0)
from (
  select
    parent.id,
    count(child.id)::int as total
  from public.roasts parent
  left join public.roasts child on child.parent_id = parent.id
  group by parent.id
) as reply_counts
where public.roasts.id = reply_counts.id
  and public.roasts.reply_count is distinct from reply_counts.total;

update public.resumes
set roast_count = coalesce(review_counts.total, 0)
from (
  select
    resumes.id,
    count(roasts.id) filter (where roasts.is_deleted = false)::int as total
  from public.resumes
  left join public.roasts on roasts.resume_id = resumes.id
  group by resumes.id
) as review_counts
where public.resumes.id = review_counts.id
  and public.resumes.roast_count is distinct from review_counts.total;

update public.profiles
set
  roast_count = coalesce(review_counts.total, 0),
  helpful_votes = coalesce(review_counts.lint_points, 0)
from (
  select
    profiles.id,
    count(roasts.id) filter (where roasts.is_deleted = false)::int as total,
    coalesce(sum(roasts.helpful_votes) filter (where roasts.is_deleted = false), 0)::int as lint_points
  from public.profiles
  left join public.roasts on roasts.author_id = profiles.id
  group by profiles.id
) as review_counts
where public.profiles.id = review_counts.id
  and (
    public.profiles.roast_count is distinct from review_counts.total
    or public.profiles.helpful_votes is distinct from review_counts.lint_points
  );

notify pgrst, 'reload schema';
