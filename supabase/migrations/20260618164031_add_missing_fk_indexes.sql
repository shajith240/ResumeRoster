-- Add partial indexes for FK columns not covered by any existing index.
-- moderation_actions.admin_user_id and profiles.resume_highlight_id were the
-- only two FKs without index coverage after auditing pg_indexes vs pg_constraint.

create index if not exists moderation_actions_admin_user_id_idx
  on public.moderation_actions (admin_user_id) where admin_user_id is not null;

create index if not exists profiles_resume_highlight_id_idx
  on public.profiles (resume_highlight_id) where resume_highlight_id is not null;
