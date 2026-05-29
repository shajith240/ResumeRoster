-- Linted 0019: realtime-ready in-app notifications.
-- Persists per-user alerts for comments, replies, helpful votes, reviewer
-- decisions, and moderation outcomes. The database is the source of truth;
-- clients can subscribe to inserts/updates on public.notifications.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null,
  body text not null default '',
  link_href text not null default '/feed',
  resume_id uuid references public.resumes(id) on delete cascade,
  roast_id uuid references public.roasts(id) on delete set null,
  parent_roast_id uuid references public.roasts(id) on delete set null,
  related_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists recipient_id uuid references public.profiles(id) on delete cascade,
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists type text,
  add column if not exists title text,
  add column if not exists body text not null default '',
  add column if not exists link_href text not null default '/feed',
  add column if not exists resume_id uuid references public.resumes(id) on delete cascade,
  add column if not exists roast_id uuid references public.roasts(id) on delete set null,
  add column if not exists parent_roast_id uuid references public.roasts(id) on delete set null,
  add column if not exists related_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists dedupe_key text,
  add column if not exists read_at timestamptz,
  add column if not exists seen_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.notifications
set
  type = coalesce(type, 'system'),
  title = left(coalesce(nullif(trim(title), ''), 'Notification'), 120),
  body = left(coalesce(body, ''), 240),
  link_href = coalesce(nullif(trim(link_href), ''), '/feed'),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

alter table public.notifications
  alter column recipient_id set not null,
  alter column type set not null,
  alter column title set not null,
  alter column body set default '',
  alter column body set not null,
  alter column link_href set default '/feed',
  alter column link_href set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  drop constraint if exists notifications_type_check,
  drop constraint if exists notifications_title_length_check,
  drop constraint if exists notifications_body_length_check,
  drop constraint if exists notifications_link_href_length_check,
  drop constraint if exists notifications_dedupe_key_length_check,
  add constraint notifications_type_check
    check (
      type in (
        'resume_feedback',
        'comment_reply',
        'resume_thread_reply',
        'helpful_vote',
        'reviewer_status',
        'moderation',
        'system'
      )
    ),
  add constraint notifications_title_length_check
    check (char_length(title) between 1 and 120),
  add constraint notifications_body_length_check
    check (char_length(body) <= 240),
  add constraint notifications_link_href_length_check
    check (char_length(link_href) between 1 and 500),
  add constraint notifications_dedupe_key_length_check
    check (dedupe_key is null or char_length(dedupe_key) <= 240);

create index if not exists notifications_recipient_created_at_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

create index if not exists notifications_resume_id_idx
  on public.notifications (resume_id)
  where resume_id is not null;

create unique index if not exists notifications_recipient_dedupe_key_idx
  on public.notifications (recipient_id, dedupe_key)
  where dedupe_key is not null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  in_app_enabled boolean not null default true,
  resume_feedback_enabled boolean not null default true,
  replies_enabled boolean not null default true,
  helpful_votes_enabled boolean not null default true,
  reviewer_status_enabled boolean not null default true,
  moderation_enabled boolean not null default true,
  system_enabled boolean not null default true,
  push_enabled boolean not null default false,
  email_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists in_app_enabled boolean not null default true,
  add column if not exists resume_feedback_enabled boolean not null default true,
  add column if not exists replies_enabled boolean not null default true,
  add column if not exists helpful_votes_enabled boolean not null default true,
  add column if not exists reviewer_status_enabled boolean not null default true,
  add column if not exists moderation_enabled boolean not null default true,
  add column if not exists system_enabled boolean not null default true,
  add column if not exists push_enabled boolean not null default false,
  add column if not exists email_enabled boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.notification_preferences
set
  in_app_enabled = coalesce(in_app_enabled, true),
  resume_feedback_enabled = coalesce(resume_feedback_enabled, true),
  replies_enabled = coalesce(replies_enabled, true),
  helpful_votes_enabled = coalesce(helpful_votes_enabled, true),
  reviewer_status_enabled = coalesce(reviewer_status_enabled, true),
  moderation_enabled = coalesce(moderation_enabled, true),
  system_enabled = coalesce(system_enabled, true),
  push_enabled = coalesce(push_enabled, false),
  email_enabled = coalesce(email_enabled, false),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

alter table public.notification_preferences
  alter column user_id set not null,
  alter column in_app_enabled set default true,
  alter column in_app_enabled set not null,
  alter column resume_feedback_enabled set default true,
  alter column resume_feedback_enabled set not null,
  alter column replies_enabled set default true,
  alter column replies_enabled set not null,
  alter column helpful_votes_enabled set default true,
  alter column helpful_votes_enabled set not null,
  alter column reviewer_status_enabled set default true,
  alter column reviewer_status_enabled set not null,
  alter column moderation_enabled set default true,
  alter column moderation_enabled set not null,
  alter column system_enabled set default true,
  alter column system_enabled set not null,
  alter column push_enabled set default false,
  alter column push_enabled set not null,
  alter column email_enabled set default false,
  alter column email_enabled set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_preferences_pkey'
      and conrelid = 'public.notification_preferences'::regclass
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_pkey primary key (user_id);
  end if;
end $$;

insert into public.notification_preferences (user_id)
select profiles.id
from public.profiles
on conflict (user_id) do nothing;

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at, seen_at, updated_at) on public.notifications to authenticated;

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "Users can mark their own notifications" on public.notifications;
create policy "Users can mark their own notifications"
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

revoke all on table public.notification_preferences from anon, authenticated;
grant select on table public.notification_preferences to authenticated;
grant insert (
  user_id,
  in_app_enabled,
  resume_feedback_enabled,
  replies_enabled,
  helpful_votes_enabled,
  reviewer_status_enabled,
  moderation_enabled,
  system_enabled,
  push_enabled,
  email_enabled
) on public.notification_preferences to authenticated;
grant update (
  in_app_enabled,
  resume_feedback_enabled,
  replies_enabled,
  helpful_votes_enabled,
  reviewer_status_enabled,
  moderation_enabled,
  system_enabled,
  push_enabled,
  email_enabled,
  updated_at
) on public.notification_preferences to authenticated;

drop policy if exists "Users can read their own notification preferences"
  on public.notification_preferences;
create policy "Users can read their own notification preferences"
  on public.notification_preferences for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create their own notification preferences"
  on public.notification_preferences;
create policy "Users can create their own notification preferences"
  on public.notification_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own notification preferences"
  on public.notification_preferences;
create policy "Users can update their own notification preferences"
  on public.notification_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.touch_notification_updated_at()
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

drop trigger if exists on_notification_updated on public.notifications;
create trigger on_notification_updated
  before update on public.notifications
  for each row execute procedure public.touch_notification_updated_at();

drop trigger if exists on_notification_preferences_updated
  on public.notification_preferences;
create trigger on_notification_preferences_updated
  before update on public.notification_preferences
  for each row execute procedure public.touch_notification_updated_at();

create or replace function public.ensure_notification_preferences_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_profile_notification_preferences_created
  on public.profiles;
create trigger on_profile_notification_preferences_created
  after insert on public.profiles
  for each row execute procedure public.ensure_notification_preferences_for_profile();

create or replace function public.notification_type_enabled(
  target_user_id uuid,
  notification_kind text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when notification_preferences.in_app_enabled = false then false
        when notification_kind = 'resume_feedback' then notification_preferences.resume_feedback_enabled
        when notification_kind in ('comment_reply', 'resume_thread_reply') then notification_preferences.replies_enabled
        when notification_kind = 'helpful_vote' then notification_preferences.helpful_votes_enabled
        when notification_kind = 'reviewer_status' then notification_preferences.reviewer_status_enabled
        when notification_kind = 'moderation' then notification_preferences.moderation_enabled
        when notification_kind = 'system' then notification_preferences.system_enabled
        else true
      end
      from public.notification_preferences
      where notification_preferences.user_id = target_user_id
      limit 1
    ),
    true
  );
$$;

create or replace function public.insert_notification(
  target_recipient_id uuid,
  target_actor_id uuid,
  notification_kind text,
  notification_title text,
  notification_body text default '',
  notification_link_href text default '/feed',
  target_resume_id uuid default null,
  target_roast_id uuid default null,
  target_parent_roast_id uuid default null,
  target_related_user_id uuid default null,
  notification_metadata jsonb default '{}'::jsonb,
  notification_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  next_notification_id uuid;
begin
  if target_recipient_id is null then
    return null;
  end if;

  if target_actor_id is not null and target_recipient_id = target_actor_id then
    return null;
  end if;

  if not public.notification_type_enabled(target_recipient_id, notification_kind) then
    return null;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    title,
    body,
    link_href,
    resume_id,
    roast_id,
    parent_roast_id,
    related_user_id,
    metadata,
    dedupe_key,
    read_at,
    seen_at,
    created_at,
    updated_at
  )
  values (
    target_recipient_id,
    target_actor_id,
    notification_kind,
    left(coalesce(nullif(trim(notification_title), ''), 'Notification'), 120),
    left(coalesce(notification_body, ''), 240),
    left(coalesce(nullif(trim(notification_link_href), ''), '/feed'), 500),
    target_resume_id,
    target_roast_id,
    target_parent_roast_id,
    target_related_user_id,
    coalesce(notification_metadata, '{}'::jsonb),
    left(nullif(trim(coalesce(notification_dedupe_key, '')), ''), 240),
    null,
    null,
    now(),
    now()
  )
  on conflict (recipient_id, dedupe_key)
    where dedupe_key is not null
  do update
  set
    actor_id = excluded.actor_id,
    type = excluded.type,
    title = excluded.title,
    body = excluded.body,
    link_href = excluded.link_href,
    resume_id = excluded.resume_id,
    roast_id = excluded.roast_id,
    parent_roast_id = excluded.parent_roast_id,
    related_user_id = excluded.related_user_id,
    metadata = excluded.metadata,
    read_at = null,
    seen_at = null,
    created_at = now(),
    updated_at = now()
  returning id into next_notification_id;

  return next_notification_id;
end;
$$;

create or replace function public.handle_roast_notification_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_resume record;
  target_parent record;
  target_parent_author_id uuid;
  notification_href text;
begin
  if new.is_deleted then
    return new;
  end if;

  select resumes.id, resumes.user_id, resumes.title
  into target_resume
  from public.resumes
  where resumes.id = new.resume_id;

  if not found then
    return new;
  end if;

  notification_href := '/resume/' || new.resume_id::text || '#comment-' || new.id::text;

  if new.parent_id is null then
    perform public.insert_notification(
      target_resume.user_id,
      new.author_id,
      'resume_feedback',
      'New feedback on your resume',
      target_resume.title,
      notification_href,
      new.resume_id,
      new.id,
      null,
      new.author_id,
      jsonb_build_object('resume_title', target_resume.title),
      'resume-feedback:' || new.id::text
    );

    return new;
  end if;

  select roasts.id, roasts.author_id
  into target_parent
  from public.roasts
  where roasts.id = new.parent_id;

  if found then
    target_parent_author_id := target_parent.author_id;

    perform public.insert_notification(
      target_parent_author_id,
      new.author_id,
      'comment_reply',
      'New reply to your comment',
      target_resume.title,
      notification_href,
      new.resume_id,
      new.id,
      new.parent_id,
      new.author_id,
      jsonb_build_object('resume_title', target_resume.title),
      'comment-reply:' || new.id::text || ':' || target_parent_author_id::text
    );
  end if;

  if target_parent_author_id is not null
    and target_resume.user_id is distinct from target_parent_author_id then
    perform public.insert_notification(
      target_resume.user_id,
      new.author_id,
      'resume_thread_reply',
      'New reply on your resume',
      target_resume.title,
      notification_href,
      new.resume_id,
      new.id,
      new.parent_id,
      new.author_id,
      jsonb_build_object('resume_title', target_resume.title),
      'resume-thread-reply:' || new.id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_roast_notification_created on public.roasts;
create trigger on_roast_notification_created
  after insert on public.roasts
  for each row execute procedure public.handle_roast_notification_created();

create or replace function public.handle_vote_notification_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_roast record;
begin
  if new.reaction <> 'like' then
    return new;
  end if;

  select
    roasts.id,
    roasts.author_id,
    roasts.resume_id,
    roasts.is_deleted,
    resumes.title as resume_title
  into target_roast
  from public.roasts
  join public.resumes on resumes.id = roasts.resume_id
  where roasts.id = new.roast_id;

  if not found or target_roast.is_deleted then
    return new;
  end if;

  perform public.insert_notification(
    target_roast.author_id,
    new.voter_id,
    'helpful_vote',
    'Your feedback was marked helpful',
    target_roast.resume_title,
    '/resume/' || target_roast.resume_id::text || '#comment-' || new.roast_id::text,
    target_roast.resume_id,
    new.roast_id,
    null,
    new.voter_id,
    jsonb_build_object('reaction', 'like', 'resume_title', target_roast.resume_title),
    'helpful-vote:' || new.roast_id::text || ':' || new.voter_id::text
  );

  return new;
end;
$$;

drop trigger if exists on_vote_notification_created on public.votes;
create trigger on_vote_notification_created
  after insert on public.votes
  for each row execute procedure public.handle_vote_notification_created();

drop trigger if exists on_vote_notification_updated on public.votes;
create trigger on_vote_notification_updated
  after update of reaction on public.votes
  for each row
  when (old.reaction is distinct from new.reaction)
  execute procedure public.handle_vote_notification_created();

create or replace function public.handle_reviewer_application_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
  notification_body text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'approved' then
    notification_title := 'Reviewer application approved';
    notification_body := 'Your trusted reviewer status is now live.';
  elsif new.status = 'rejected' then
    notification_title := 'Reviewer application update';
    notification_body := 'Your reviewer application was not approved.';
  elsif new.status = 'pending' then
    notification_title := 'Reviewer application back in review';
    notification_body := 'Your reviewer application is pending again.';
  else
    return new;
  end if;

  perform public.insert_notification(
    new.user_id,
    new.reviewed_by,
    'reviewer_status',
    notification_title,
    notification_body,
    '/profile/me',
    null,
    null,
    null,
    new.reviewed_by,
    jsonb_build_object(
      'application_id', new.id,
      'status', new.status,
      'requested_type', new.requested_type
    ),
    'reviewer-application:' || new.id::text || ':' || new.status
  );

  return new;
end;
$$;

drop trigger if exists on_reviewer_application_notification
  on public.reviewer_applications;
create trigger on_reviewer_application_notification
  after update of status on public.reviewer_applications
  for each row execute procedure public.handle_reviewer_application_notification();

create or replace function public.handle_moderation_action_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_roast record;
  target_resume record;
  target_report record;
  reporter_title text;
begin
  if new.action in ('remove_roast', 'restore_roast')
    and new.target_type = 'roast'
    and new.target_id is not null then
    select roasts.id, roasts.author_id, roasts.resume_id, resumes.title as resume_title
    into target_roast
    from public.roasts
    join public.resumes on resumes.id = roasts.resume_id
    where roasts.id = new.target_id;

    if found then
      perform public.insert_notification(
        target_roast.author_id,
        new.admin_user_id,
        'moderation',
        case
          when new.action = 'remove_roast' then 'Your comment was removed'
          else 'Your comment was restored'
        end,
        target_roast.resume_title,
        '/resume/' || target_roast.resume_id::text || '#comment-' || target_roast.id::text,
        target_roast.resume_id,
        target_roast.id,
        null,
        new.admin_user_id,
        jsonb_build_object('moderation_action_id', new.id, 'action', new.action),
        'moderation:' || new.action || ':' || target_roast.id::text
      );
    end if;
  end if;

  if new.action in ('close_resume', 'reopen_resume')
    and new.target_type = 'resume'
    and new.target_id is not null then
    select resumes.id, resumes.user_id, resumes.title
    into target_resume
    from public.resumes
    where resumes.id = new.target_id;

    if found then
      perform public.insert_notification(
        target_resume.user_id,
        new.admin_user_id,
        'moderation',
        case
          when new.action = 'close_resume' then 'Your resume was closed'
          else 'Your resume was reopened'
        end,
        target_resume.title,
        '/resume/' || target_resume.id::text,
        target_resume.id,
        null,
        null,
        new.admin_user_id,
        jsonb_build_object('moderation_action_id', new.id, 'action', new.action),
        'moderation:' || new.action || ':' || target_resume.id::text
      );
    end if;
  end if;

  if new.report_id is not null
    and new.action in (
      'dismiss_report',
      'mark_report_actioned',
      'remove_roast',
      'close_resume'
    ) then
    select
      content_reports.id,
      content_reports.reporter_id,
      content_reports.resume_id,
      content_reports.roast_id,
      resumes.title as resume_title
    into target_report
    from public.content_reports
    left join public.resumes on resumes.id = content_reports.resume_id
    where content_reports.id = new.report_id;

    if found then
      reporter_title := case
        when new.action = 'dismiss_report' then 'Report reviewed'
        else 'Report actioned'
      end;

      perform public.insert_notification(
        target_report.reporter_id,
        new.admin_user_id,
        'moderation',
        reporter_title,
        coalesce(target_report.resume_title, 'Thanks for keeping Linted useful.'),
        case
          when target_report.resume_id is not null then '/resume/' || target_report.resume_id::text
          else '/feed'
        end,
        target_report.resume_id,
        target_report.roast_id,
        null,
        new.admin_user_id,
        jsonb_build_object('moderation_action_id', new.id, 'action', new.action, 'report_id', target_report.id),
        'report:' || new.action || ':' || target_report.id::text
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_moderation_action_notification
  on public.moderation_actions;
create trigger on_moderation_action_notification
  after insert on public.moderation_actions
  for each row execute procedure public.handle_moderation_action_notification();

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

revoke all on function public.touch_notification_updated_at() from public, anon, authenticated;
revoke all on function public.ensure_notification_preferences_for_profile() from public, anon, authenticated;
revoke all on function public.notification_type_enabled(uuid, text) from public, anon, authenticated;
revoke all on function public.insert_notification(uuid, uuid, text, text, text, text, uuid, uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.handle_roast_notification_created() from public, anon, authenticated;
revoke all on function public.handle_vote_notification_created() from public, anon, authenticated;
revoke all on function public.handle_reviewer_application_notification() from public, anon, authenticated;
revoke all on function public.handle_moderation_action_notification() from public, anon, authenticated;

notify pgrst, 'reload schema';
