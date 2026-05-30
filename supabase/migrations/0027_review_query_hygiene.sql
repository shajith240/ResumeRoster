-- Linted 0027: review query hygiene.
-- Keeps the v1 compatibility layer intact while giving new code a safer
-- non-deleted review surface and documenting legacy physical names.

create index if not exists votes_voter_id_created_at_idx
  on public.votes (voter_id, created_at desc);

create or replace view public.active_resume_reviews
with (security_invoker = true)
as
select
  roasts.id,
  roasts.resume_id,
  roasts.parent_id as parent_review_id,
  roasts.author_id as reviewer_id,
  roasts.content,
  roasts.attachment_id,
  roasts.content_format,
  roasts.sticker_id,
  roasts.helpful_votes as lint_points,
  roasts.dislike_count,
  roasts.reply_count,
  roasts.created_at
from public.roasts
where roasts.is_deleted = false;

grant select on public.active_resume_reviews to authenticated;

comment on table public.roasts is
  'Legacy physical table for resume reviews. Keep for v1 compatibility; prefer resume_reviews or active_resume_reviews in new read paths.';

comment on view public.resume_reviews is
  'Linted naming compatibility view over roasts. Includes deleted/tombstone rows for thread rendering.';

comment on view public.active_resume_reviews is
  'Linted naming compatibility view for non-deleted resume reviews only.';

comment on table public.votes is
  'One reaction per user per resume review. Like reactions are lint points.';

comment on column public.roasts.helpful_votes is
  'Lint points for this review, maintained from like rows in public.votes.';

comment on column public.profiles.helpful_votes is
  'Reviewer lint points, maintained as the sum of live review helpful_votes.';

comment on column public.resumes.is_anonymous is
  'Legacy compatibility mirror for privacy_mode. Constrained so public=false and contact_hidden/anonymous=true.';

comment on table public.content_reports is
  'Private moderation reports. target_type and target id columns are protected by content_reports_target_shape_check.';

notify pgrst, 'reload schema';
