-- Linted 0010: admin moderation surface and curated roast stickers.
-- Adds admin-reviewable stickers, optional sticker attachments on roasts, and
-- richer report prioritization without exposing moderation tables to clients.

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  alt_text text not null default '',
  storage_path text not null unique,
  mime_type text not null,
  file_size int not null,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stickers
  add column if not exists title text,
  add column if not exists alt_text text not null default '',
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size int,
  add column if not exists status text not null default 'active',
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.stickers
set
  alt_text = coalesce(alt_text, ''),
  status = case when status in ('active', 'hidden') then status else 'active' end,
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.stickers
  alter column title set not null,
  alter column alt_text set default '',
  alter column alt_text set not null,
  alter column storage_path set not null,
  alter column mime_type set not null,
  alter column file_size set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  drop constraint if exists stickers_status_check,
  drop constraint if exists stickers_mime_type_check,
  drop constraint if exists stickers_file_size_check,
  drop constraint if exists stickers_title_length_check,
  drop constraint if exists stickers_alt_text_length_check,
  add constraint stickers_status_check
    check (status in ('active', 'hidden')),
  add constraint stickers_mime_type_check
    check (mime_type in ('image/png', 'image/webp', 'image/gif')),
  add constraint stickers_file_size_check
    check (file_size > 0 and file_size <= 2097152),
  add constraint stickers_title_length_check
    check (char_length(title) between 1 and 80),
  add constraint stickers_alt_text_length_check
    check (char_length(alt_text) <= 160);

create unique index if not exists stickers_storage_path_unique_idx
  on public.stickers (storage_path);

create index if not exists stickers_status_created_at_idx
  on public.stickers (status, created_at desc);

alter table public.roasts
  add column if not exists sticker_id uuid references public.stickers(id) on delete set null;

create index if not exists roasts_sticker_id_idx
  on public.roasts (sticker_id)
  where sticker_id is not null;

alter table public.content_reports
  add column if not exists report_count int not null default 1,
  add column if not exists last_reported_at timestamptz not null default now();

update public.content_reports
set
  report_count = greatest(coalesce(report_count, 1), 1),
  last_reported_at = coalesce(last_reported_at, updated_at, created_at, now());

alter table public.content_reports
  alter column report_count set default 1,
  alter column report_count set not null,
  alter column last_reported_at set default now(),
  alter column last_reported_at set not null,
  drop constraint if exists content_reports_report_count_check,
  add constraint content_reports_report_count_check
    check (report_count > 0);

create index if not exists content_reports_priority_idx
  on public.content_reports (status, report_count desc, last_reported_at desc);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  report_id uuid references public.content_reports(id) on delete set null,
  reason text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.moderation_actions
  add column if not exists admin_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists action text,
  add column if not exists target_type text,
  add column if not exists target_id uuid,
  add column if not exists report_id uuid references public.content_reports(id) on delete set null,
  add column if not exists reason text not null default '',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

update public.moderation_actions
set
  reason = coalesce(reason, ''),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, now());

alter table public.moderation_actions
  alter column action set not null,
  alter column target_type set not null,
  alter column reason set default '',
  alter column reason set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
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
        'delete_sticker'
      )
    ),
  add constraint moderation_actions_target_type_check
    check (target_type in ('report', 'roast', 'resume', 'sticker'));

create index if not exists moderation_actions_created_at_idx
  on public.moderation_actions (created_at desc);

create index if not exists moderation_actions_report_id_idx
  on public.moderation_actions (report_id)
  where report_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stickers',
  'stickers',
  true,
  2097152,
  array['image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/webp', 'image/gif'];

alter table public.stickers enable row level security;
alter table public.moderation_actions enable row level security;

revoke all on table public.stickers from anon, authenticated;
grant select on table public.stickers to authenticated;

drop policy if exists "Active stickers are readable by authenticated users" on public.stickers;
create policy "Active stickers are readable by authenticated users"
  on public.stickers for select
  to authenticated
  using (status = 'active');

revoke all on table public.moderation_actions from anon, authenticated;

drop policy if exists "Authenticated users cannot read moderation actions" on public.moderation_actions;
create policy "Authenticated users cannot read moderation actions"
  on public.moderation_actions for select
  to authenticated
  using (false);

drop policy if exists "Sticker files are public" on storage.objects;
create policy "Sticker files are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'stickers');

grant insert (sticker_id) on public.roasts to authenticated;

drop policy if exists "Authenticated users can create roasts" on public.roasts;
create policy "Authenticated users can create roasts"
  on public.roasts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and is_deleted = false
    and (
      sticker_id is null
      or exists (
        select 1
        from public.stickers
        where stickers.id = roasts.sticker_id
          and stickers.status = 'active'
      )
    )
    and exists (
      select 1
      from public.resumes
      where resumes.id = roasts.resume_id
        and resumes.status = 'open'
        and (
          (
            roasts.parent_id is null
            and resumes.user_id <> auth.uid()
          )
          or roasts.parent_id is not null
        )
    )
  );

drop function if exists public.report_content(text, uuid, uuid, text, text);

create or replace function public.report_content(
  report_target_type text,
  target_resume_id uuid default null,
  target_roast_id uuid default null,
  report_reason text default 'other',
  report_details text default ''
)
returns table (
  id uuid,
  status text,
  was_duplicate boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_user uuid := auth.uid();
  normalized_target_type text := lower(trim(coalesce(report_target_type, '')));
  normalized_reason text := lower(trim(coalesce(report_reason, 'other')));
  normalized_details text := trim(coalesce(report_details, ''));
  target_resume record;
  target_roast record;
  existing_report_id uuid;
  next_report record;
  resolved_resume_id uuid := target_resume_id;
  resolved_reported_user_id uuid;
begin
  if active_user is null then
    raise exception 'Sign in to report content.';
  end if;

  if normalized_target_type not in ('resume', 'roast') then
    raise exception 'Choose valid content to report.';
  end if;

  if normalized_reason not in ('personal_info', 'harassment', 'spam', 'unsafe', 'off_topic', 'other') then
    raise exception 'Choose a valid report reason.';
  end if;

  if char_length(normalized_details) > 800 then
    raise exception 'Keep report details under 800 characters.';
  end if;

  if normalized_target_type = 'resume' then
    if target_resume_id is null or target_roast_id is not null then
      raise exception 'Choose one resume to report.';
    end if;

    select resumes.id, resumes.user_id, resumes.status
    into target_resume
    from public.resumes
    where resumes.id = target_resume_id
      and resumes.status in ('open', 'closed');

    if not found then
      raise exception 'This resume is not available to report.';
    end if;

    if target_resume.user_id = active_user then
      raise exception 'You cannot report your own resume.';
    end if;

    resolved_reported_user_id := target_resume.user_id;
  else
    if target_roast_id is null then
      raise exception 'Choose one roast to report.';
    end if;

    select
      roasts.id,
      roasts.resume_id,
      roasts.author_id,
      roasts.is_deleted,
      resumes.status as resume_status
    into target_roast
    from public.roasts
    join public.resumes on resumes.id = roasts.resume_id
    where roasts.id = target_roast_id;

    if not found
      or target_roast.is_deleted
      or target_roast.resume_status not in ('open', 'closed') then
      raise exception 'This roast is not available to report.';
    end if;

    if target_roast.author_id = active_user then
      raise exception 'You cannot report your own roast.';
    end if;

    resolved_resume_id := target_roast.resume_id;
    resolved_reported_user_id := target_roast.author_id;
  end if;

  select content_reports.id
  into existing_report_id
  from public.content_reports
  where content_reports.reporter_id = active_user
    and content_reports.status = 'pending'
    and (
      (
        normalized_target_type = 'resume'
        and content_reports.target_type = 'resume'
        and content_reports.resume_id = target_resume_id
      )
      or (
        normalized_target_type = 'roast'
        and content_reports.target_type = 'roast'
        and content_reports.roast_id = target_roast_id
      )
    )
  limit 1
  for update;

  if existing_report_id is not null then
    update public.content_reports
    set
      reason = normalized_reason,
      details = normalized_details,
      report_count = content_reports.report_count + 1,
      last_reported_at = now()
    where content_reports.id = existing_report_id
    returning content_reports.id, content_reports.status
    into next_report;

    id := next_report.id;
    status := next_report.status;
    was_duplicate := true;
    return next;
    return;
  end if;

  insert into public.content_reports (
    reporter_id,
    reported_user_id,
    resume_id,
    roast_id,
    target_type,
    reason,
    details,
    report_count,
    last_reported_at
  )
  values (
    active_user,
    resolved_reported_user_id,
    resolved_resume_id,
    case when normalized_target_type = 'roast' then target_roast_id else null end,
    normalized_target_type,
    normalized_reason,
    normalized_details,
    1,
    now()
  )
  returning content_reports.id, content_reports.status
  into next_report;

  id := next_report.id;
  status := next_report.status;
  was_duplicate := false;
  return next;
end;
$$;

revoke all on function public.report_content(text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_content(text, uuid, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
