-- Linted 0067: user feedback inbox for the admin console.
-- Gives signed-in users a narrow way to send product feedback while keeping
-- review, reply, assignment, and resolution private to the service-role admin
-- surface.

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  category text not null default 'other',
  priority text not null default 'normal',
  status text not null default 'new',
  title text not null,
  body text not null,
  source_path text,
  user_agent text,
  viewport text,
  metadata jsonb not null default '{}'::jsonb,
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  admin_note text,
  admin_reply text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_feedback
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists category text not null default 'other',
  add column if not exists priority text not null default 'normal',
  add column if not exists status text not null default 'new',
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists source_path text,
  add column if not exists user_agent text,
  add column if not exists viewport text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists assigned_admin_id uuid references public.profiles(id) on delete set null,
  add column if not exists admin_note text,
  add column if not exists admin_reply text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.user_feedback
set
  category = case
    when category in ('bug', 'ui_ux', 'performance', 'feature_request', 'account', 'content_safety', 'other') then category
    else 'other'
  end,
  priority = case
    when priority in ('low', 'normal', 'high', 'urgent') then priority
    else 'normal'
  end,
  status = case
    when status in ('new', 'reviewing', 'needs_user_reply', 'planned', 'resolved', 'closed') then status
    else 'new'
  end,
  title = left(trim(coalesce(title, 'Product feedback')), 120),
  body = left(trim(coalesce(body, '')), 2000),
  source_path = nullif(left(trim(coalesce(source_path, '')), 500), ''),
  user_agent = nullif(left(trim(coalesce(user_agent, '')), 500), ''),
  viewport = nullif(left(trim(coalesce(viewport, '')), 80), ''),
  metadata = case
    when jsonb_typeof(coalesce(metadata, '{}'::jsonb)) = 'object' then coalesce(metadata, '{}'::jsonb)
    else '{}'::jsonb
  end,
  admin_note = nullif(left(trim(coalesce(admin_note, '')), 1000), ''),
  admin_reply = nullif(left(trim(coalesce(admin_reply, '')), 800), ''),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.user_feedback
  alter column category set not null,
  alter column category set default 'other',
  alter column priority set not null,
  alter column priority set default 'normal',
  alter column status set not null,
  alter column status set default 'new',
  alter column title set not null,
  alter column body set not null,
  alter column metadata set not null,
  alter column metadata set default '{}'::jsonb,
  alter column created_at set not null,
  alter column created_at set default now(),
  alter column updated_at set not null,
  alter column updated_at set default now();

alter table public.user_feedback
  drop constraint if exists user_feedback_category_check,
  drop constraint if exists user_feedback_priority_check,
  drop constraint if exists user_feedback_status_check,
  drop constraint if exists user_feedback_title_length_check,
  drop constraint if exists user_feedback_body_length_check,
  drop constraint if exists user_feedback_source_path_length_check,
  drop constraint if exists user_feedback_user_agent_length_check,
  drop constraint if exists user_feedback_viewport_length_check,
  drop constraint if exists user_feedback_admin_note_length_check,
  drop constraint if exists user_feedback_admin_reply_length_check,
  drop constraint if exists user_feedback_metadata_object_check,
  add constraint user_feedback_category_check
    check (category in ('bug', 'ui_ux', 'performance', 'feature_request', 'account', 'content_safety', 'other')),
  add constraint user_feedback_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent')),
  add constraint user_feedback_status_check
    check (status in ('new', 'reviewing', 'needs_user_reply', 'planned', 'resolved', 'closed')),
  add constraint user_feedback_title_length_check
    check (char_length(title) between 3 and 120),
  add constraint user_feedback_body_length_check
    check (char_length(body) between 10 and 2000),
  add constraint user_feedback_source_path_length_check
    check (source_path is null or char_length(source_path) <= 500),
  add constraint user_feedback_user_agent_length_check
    check (user_agent is null or char_length(user_agent) <= 500),
  add constraint user_feedback_viewport_length_check
    check (viewport is null or char_length(viewport) <= 80),
  add constraint user_feedback_admin_note_length_check
    check (admin_note is null or char_length(admin_note) <= 1000),
  add constraint user_feedback_admin_reply_length_check
    check (admin_reply is null or char_length(admin_reply) <= 800),
  add constraint user_feedback_metadata_object_check
    check (jsonb_typeof(metadata) = 'object');

create index if not exists user_feedback_status_priority_created_at_idx
  on public.user_feedback (status, priority, created_at desc);

create index if not exists user_feedback_category_status_created_at_idx
  on public.user_feedback (category, status, created_at desc);

create index if not exists user_feedback_user_created_at_idx
  on public.user_feedback (user_id, created_at desc);

alter table public.user_feedback enable row level security;
revoke all on table public.user_feedback from anon, authenticated;

drop policy if exists "Users cannot read feedback directly" on public.user_feedback;
create policy "Users cannot read feedback directly"
  on public.user_feedback for select
  to authenticated
  using (false);

create or replace function public.touch_user_feedback_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_user_feedback_updated on public.user_feedback;
create trigger on_user_feedback_updated
  before update on public.user_feedback
  for each row execute procedure public.touch_user_feedback_updated_at();

alter table public.moderation_actions
  drop constraint if exists moderation_actions_action_check,
  drop constraint if exists moderation_actions_target_type_check,
  add constraint moderation_actions_action_check
    check (
      action in (
        'dismiss_report',
        'mark_report_reviewing',
        'mark_report_actioned',
        'remove_roast',
        'restore_roast',
        'close_resume',
        'reopen_resume',
        'hide_sticker',
        'show_sticker',
        'upload_sticker',
        'delete_sticker',
        'approve_reviewer',
        'reject_reviewer',
        'reset_reviewer',
        'reset_reviewer_trust',
        'clear_public_profile_text',
        'clear_reviewer_profile',
        'delete_user_account',
        'send_admin_message',
        'remove_community_post',
        'restore_community_post',
        'lock_community_post',
        'unlock_community_post',
        'hard_delete_community_post',
        'remove_community_comment',
        'restore_community_comment',
        'mark_feedback_reviewing',
        'mark_feedback_needs_user_reply',
        'mark_feedback_planned',
        'mark_feedback_resolved',
        'close_feedback_ticket',
        'reopen_feedback_ticket',
        'update_feedback_priority',
        'reply_feedback_ticket'
      )
    ),
  add constraint moderation_actions_target_type_check
    check (
      target_type in (
        'report',
        'roast',
        'resume',
        'sticker',
        'reviewer_application',
        'profile',
        'user',
        'broadcast',
        'community_post',
        'community_comment',
        'feedback'
      )
    );

comment on table public.user_feedback is
  'Private product feedback and support tickets submitted from the signed-in user menu.';

notify pgrst, 'reload schema';
