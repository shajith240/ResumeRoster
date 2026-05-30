-- Linted 0028: authenticated write rate limits.
-- Adds database-level abuse protection for high-frequency community actions
-- while leaving service-role admin/maintenance actions unblocked.

create table if not exists public.request_rate_limits (
  rate_key text not null,
  action text not null,
  window_start timestamptz not null default now(),
  request_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (rate_key, action)
);

alter table public.request_rate_limits
  add column if not exists rate_key text,
  add column if not exists action text,
  add column if not exists window_start timestamptz not null default now(),
  add column if not exists request_count int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

update public.request_rate_limits
set
  window_start = coalesce(window_start, now()),
  request_count = greatest(coalesce(request_count, 0), 0),
  updated_at = coalesce(updated_at, now());

alter table public.request_rate_limits
  alter column rate_key set not null,
  alter column action set not null,
  alter column window_start set default now(),
  alter column window_start set not null,
  alter column request_count set default 0,
  alter column request_count set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  drop constraint if exists request_rate_limits_action_length_check,
  drop constraint if exists request_rate_limits_rate_key_length_check,
  drop constraint if exists request_rate_limits_request_count_check,
  add constraint request_rate_limits_action_length_check
    check (char_length(action) between 1 and 80),
  add constraint request_rate_limits_rate_key_length_check
    check (char_length(rate_key) between 32 and 128),
  add constraint request_rate_limits_request_count_check
    check (request_count >= 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'request_rate_limits_pkey'
      and conrelid = 'public.request_rate_limits'::regclass
  ) then
    alter table public.request_rate_limits
      add constraint request_rate_limits_pkey primary key (rate_key, action);
  end if;
end $$;

create index if not exists request_rate_limits_updated_at_idx
  on public.request_rate_limits (updated_at);

alter table public.request_rate_limits enable row level security;
revoke all on table public.request_rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(
  target_rate_key text,
  target_action text,
  window_seconds int,
  max_requests int
)
returns table (
  allowed boolean,
  remaining int,
  retry_after_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := clock_timestamp();
  active_window interval := make_interval(
    secs => least(greatest(coalesce(window_seconds, 60), 10), 86400)
  );
  active_limit int := least(greatest(coalesce(max_requests, 1), 1), 10000);
  next_row public.request_rate_limits%rowtype;
begin
  if nullif(trim(coalesce(target_rate_key, '')), '') is null
    or nullif(trim(coalesce(target_action, '')), '') is null then
    raise exception 'Rate limit key and action are required.';
  end if;

  delete from public.request_rate_limits
  where updated_at < now_ts - interval '7 days';

  insert into public.request_rate_limits (
    rate_key,
    action,
    window_start,
    request_count,
    updated_at
  )
  values (
    left(trim(target_rate_key), 128),
    left(trim(target_action), 80),
    now_ts,
    1,
    now_ts
  )
  on conflict (rate_key, action) do update
  set
    window_start = case
      when public.request_rate_limits.window_start <= now_ts - active_window
        then now_ts
      else public.request_rate_limits.window_start
    end,
    request_count = case
      when public.request_rate_limits.window_start <= now_ts - active_window
        then 1
      else public.request_rate_limits.request_count + 1
    end,
    updated_at = now_ts
  returning * into next_row;

  allowed := next_row.request_count <= active_limit;
  remaining := greatest(active_limit - next_row.request_count, 0);
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (next_row.window_start + active_window - now_ts)))::int
    )
  end;

  return next;
end;
$$;

create or replace function public.enforce_authenticated_rate_limit(
  target_action text,
  window_seconds int,
  max_requests int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_user uuid := auth.uid();
  active_role text := auth.role();
  limit_row record;
begin
  if active_role = 'service_role' then
    return;
  end if;

  if active_user is null then
    raise exception 'Sign in to continue.';
  end if;

  select *
  into limit_row
  from public.check_rate_limit(
    encode(digest('user:' || active_user::text, 'sha256'), 'hex'),
    target_action,
    window_seconds,
    max_requests
  );

  if not coalesce(limit_row.allowed, false) then
    raise exception 'Too many requests. Try again soon.';
  end if;
end;
$$;

create or replace function public.guard_review_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_authenticated_rate_limit('review_insert', 600, 30);
  return new;
end;
$$;

drop trigger if exists enforce_review_insert_rate_limit on public.roasts;
drop trigger if exists enforce_roast_insert_rate_limit on public.roasts;
create trigger enforce_review_insert_rate_limit
  before insert on public.roasts
  for each row execute procedure public.guard_review_insert_rate_limit();

create or replace function public.guard_vote_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_authenticated_rate_limit('vote_write', 300, 120);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_vote_insert_rate_limit on public.votes;
create trigger enforce_vote_insert_rate_limit
  before insert on public.votes
  for each row execute procedure public.guard_vote_write_rate_limit();

drop trigger if exists enforce_vote_update_rate_limit on public.votes;
create trigger enforce_vote_update_rate_limit
  before update of reaction on public.votes
  for each row execute procedure public.guard_vote_write_rate_limit();

drop trigger if exists enforce_vote_delete_rate_limit on public.votes;
create trigger enforce_vote_delete_rate_limit
  before delete on public.votes
  for each row execute procedure public.guard_vote_write_rate_limit();

create or replace function public.guard_saved_resume_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_authenticated_rate_limit('saved_resume_write', 300, 80);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_saved_resume_insert_rate_limit on public.saved_resumes;
create trigger enforce_saved_resume_insert_rate_limit
  before insert on public.saved_resumes
  for each row execute procedure public.guard_saved_resume_rate_limit();

drop trigger if exists enforce_saved_resume_delete_rate_limit on public.saved_resumes;
create trigger enforce_saved_resume_delete_rate_limit
  before delete on public.saved_resumes
  for each row execute procedure public.guard_saved_resume_rate_limit();

drop function if exists public.report_content(text, uuid, uuid, uuid, text, text);

create or replace function public.report_content(
  report_target_type text,
  target_resume_id uuid default null,
  target_roast_id uuid default null,
  target_profile_id uuid default null,
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
  raw_target_type text := lower(trim(coalesce(report_target_type, '')));
  normalized_target_type text := case
    when raw_target_type in ('review', 'resume_review') then 'roast'
    else raw_target_type
  end;
  normalized_reason text := lower(trim(coalesce(report_reason, 'other')));
  normalized_details text := trim(coalesce(report_details, ''));
  target_resume record;
  target_roast record;
  target_profile record;
  existing_report_id uuid;
  next_report record;
  resolved_resume_id uuid := target_resume_id;
  resolved_profile_id uuid := target_profile_id;
  resolved_reported_user_id uuid;
begin
  if active_user is null then
    raise exception 'Sign in to report content.';
  end if;

  perform public.enforce_authenticated_rate_limit('content_report', 3600, 20);

  if normalized_target_type not in ('resume', 'roast', 'profile') then
    raise exception 'Choose valid content to report.';
  end if;

  if normalized_reason not in ('personal_info', 'harassment', 'spam', 'unsafe', 'off_topic', 'other') then
    raise exception 'Choose a valid report reason.';
  end if;

  if char_length(normalized_details) > 800 then
    raise exception 'Keep report details under 800 characters.';
  end if;

  if normalized_target_type = 'resume' then
    if target_resume_id is null or target_roast_id is not null or target_profile_id is not null then
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
  elsif normalized_target_type = 'roast' then
    if target_roast_id is null or target_profile_id is not null then
      raise exception 'Choose one review to report.';
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
      raise exception 'This review is not available to report.';
    end if;

    if target_roast.author_id = active_user then
      raise exception 'You cannot report your own review.';
    end if;

    resolved_resume_id := target_roast.resume_id;
    resolved_reported_user_id := target_roast.author_id;
  else
    if target_profile_id is null or target_resume_id is not null or target_roast_id is not null then
      raise exception 'Choose one profile to report.';
    end if;

    select profiles.id
    into target_profile
    from public.profiles
    where profiles.id = target_profile_id;

    if not found then
      raise exception 'This profile is not available to report.';
    end if;

    if target_profile.id = active_user then
      raise exception 'You cannot report your own profile.';
    end if;

    resolved_profile_id := target_profile.id;
    resolved_reported_user_id := target_profile.id;
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
      or (
        normalized_target_type = 'profile'
        and content_reports.target_type = 'profile'
        and content_reports.profile_id = target_profile_id
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
    profile_id,
    target_type,
    reason,
    details,
    report_count,
    last_reported_at
  )
  values (
    active_user,
    resolved_reported_user_id,
    case when normalized_target_type = 'resume' then resolved_resume_id when normalized_target_type = 'roast' then resolved_resume_id else null end,
    case when normalized_target_type = 'roast' then target_roast_id else null end,
    case when normalized_target_type = 'profile' then resolved_profile_id else null end,
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

revoke all on function public.check_rate_limit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, int, int) to service_role;

revoke all on function public.enforce_authenticated_rate_limit(text, int, int) from public, anon, authenticated;
revoke all on function public.guard_review_insert_rate_limit() from public, anon, authenticated;
revoke all on function public.guard_vote_write_rate_limit() from public, anon, authenticated;
revoke all on function public.guard_saved_resume_rate_limit() from public, anon, authenticated;

revoke all on function public.report_content(text, uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_content(text, uuid, uuid, uuid, text, text) to authenticated;

comment on table public.request_rate_limits is
  'Private DB-backed rate limit buckets for authenticated write actions.';

notify pgrst, 'reload schema';
