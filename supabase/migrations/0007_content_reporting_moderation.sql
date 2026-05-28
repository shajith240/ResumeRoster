-- Linted 0007: content reporting and moderation queue.
-- Users can report visible resumes or roasts through a narrow RPC. The queue is
-- private by default and intended for service-role/admin review in Supabase.

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  resume_id uuid references public.resumes(id) on delete cascade,
  roast_id uuid references public.roasts(id) on delete cascade,
  target_type text not null default 'roast',
  reason text not null,
  details text not null default '',
  status text not null default 'pending',
  moderator_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_reports
  add column if not exists reporter_id uuid references public.profiles(id) on delete cascade,
  add column if not exists reported_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists resume_id uuid references public.resumes(id) on delete cascade,
  add column if not exists roast_id uuid references public.roasts(id) on delete cascade,
  add column if not exists target_type text not null default 'roast',
  add column if not exists reason text,
  add column if not exists details text not null default '',
  add column if not exists status text not null default 'pending',
  add column if not exists moderator_note text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.content_reports
set
  target_type = case when roast_id is not null then 'roast' else 'resume' end,
  reason = coalesce(reason, 'other'),
  details = left(coalesce(details, ''), 800),
  status = case
    when status in ('pending', 'reviewing', 'dismissed', 'actioned') then status
    else 'pending'
  end,
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.content_reports
  alter column target_type set default 'roast',
  alter column target_type set not null,
  alter column reason set not null,
  alter column details set default '',
  alter column details set not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.content_reports
  drop constraint if exists content_reports_target_type_check,
  drop constraint if exists content_reports_reason_check,
  drop constraint if exists content_reports_status_check,
  drop constraint if exists content_reports_details_length_check,
  drop constraint if exists content_reports_target_shape_check,
  add constraint content_reports_target_type_check
    check (target_type in ('resume', 'roast')),
  add constraint content_reports_reason_check
    check (reason in ('personal_info', 'harassment', 'spam', 'unsafe', 'off_topic', 'other')),
  add constraint content_reports_status_check
    check (status in ('pending', 'reviewing', 'dismissed', 'actioned')),
  add constraint content_reports_details_length_check
    check (char_length(details) <= 800),
  add constraint content_reports_target_shape_check
    check (
      (
        target_type = 'resume'
        and resume_id is not null
        and roast_id is null
      )
      or (
        target_type = 'roast'
        and resume_id is not null
        and roast_id is not null
      )
    );

create index if not exists content_reports_status_created_at_idx
  on public.content_reports (status, created_at desc);

create index if not exists content_reports_reporter_created_at_idx
  on public.content_reports (reporter_id, created_at desc);

create index if not exists content_reports_resume_id_idx
  on public.content_reports (resume_id);

create index if not exists content_reports_roast_id_idx
  on public.content_reports (roast_id)
  where roast_id is not null;

create unique index if not exists content_reports_pending_resume_unique_idx
  on public.content_reports (reporter_id, resume_id)
  where target_type = 'resume'
    and status = 'pending';

create unique index if not exists content_reports_pending_roast_unique_idx
  on public.content_reports (reporter_id, roast_id)
  where target_type = 'roast'
    and status = 'pending';

alter table public.content_reports enable row level security;

revoke all on table public.content_reports from anon, authenticated;

drop policy if exists "Reporters can read their own reports" on public.content_reports;
drop policy if exists "Authenticated users cannot read reports directly" on public.content_reports;
create policy "Authenticated users cannot read reports directly"
  on public.content_reports for select
  to authenticated
  using (false);

create or replace function public.touch_content_report_updated_at()
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

drop trigger if exists on_content_report_updated on public.content_reports;
create trigger on_content_report_updated
  before update on public.content_reports
  for each row execute procedure public.touch_content_report_updated_at();

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
      details = normalized_details
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
    details
  )
  values (
    active_user,
    resolved_reported_user_id,
    resolved_resume_id,
    case when normalized_target_type = 'roast' then target_roast_id else null end,
    normalized_target_type,
    normalized_reason,
    normalized_details
  )
  returning content_reports.id, content_reports.status
  into next_report;

  id := next_report.id;
  status := next_report.status;
  was_duplicate := false;
  return next;
end;
$$;

revoke all on function public.touch_content_report_updated_at() from public, anon, authenticated;
revoke all on function public.report_content(text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_content(text, uuid, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
