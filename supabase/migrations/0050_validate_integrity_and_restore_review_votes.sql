-- Linted 0050: validate historical integrity and make moderation restore lossless.
-- This migration keeps current product behavior while tightening older
-- NOT VALID constraints and preserving review vote source-of-truth across
-- moderation remove/restore flows.

-- Clean optional legacy resume context before validating length checks.
-- Older rows without enough context are treated like older posts with no
-- attached context, which the UI already supports.
update public.resumes
set job_description = case
  when job_description is null then null
  when char_length(job_description) > 8000 then left(job_description, 8000)
  when char_length(job_description) < 20 then null
  else job_description
end
where job_description is not null
  and char_length(job_description) not between 20 and 8000;

update public.resumes
set post_description = case
  when post_description is null then null
  when char_length(post_description) > 4000 then left(post_description, 4000)
  when char_length(post_description) < 10 then null
  else post_description
end
where post_description is not null
  and char_length(post_description) not between 10 and 4000;

-- Remove orphan read rows before validating the auth.users foreign key, then
-- make the cached read_count match the remaining source-of-truth rows.
delete from public.resume_reads
where not exists (
  select 1
  from auth.users
  where users.id = resume_reads.reader_id
);

update public.resumes
set read_count = coalesce(read_counts.total, 0)
from (
  select
    resumes.id,
    count(resume_reads.reader_id)::int as total
  from public.resumes
  left join public.resume_reads on resume_reads.resume_id = resumes.id
  group by resumes.id
) as read_counts
where resumes.id = read_counts.id
  and resumes.read_count is distinct from read_counts.total;

-- Profile highlights should point to an existing resume owned by the profile.
update public.profiles
set resume_highlight_id = null
where resume_highlight_id is not null
  and not exists (
    select 1
    from public.resumes
    where resumes.id = profiles.resume_highlight_id
      and resumes.user_id = profiles.id
  );

-- Preserve orphaned or invalid replies as visible top-level comments instead
-- of deleting user content, then repair reply counters from source rows.
update public.roasts as child
set parent_id = null
where child.parent_id is not null
  and (
    child.parent_id = child.id
    or not exists (
      select 1
      from public.roasts as parent
      where parent.id = child.parent_id
        and parent.resume_id = child.resume_id
    )
  );

update public.roasts
set reply_count = coalesce(reply_counts.total, 0)
from (
  select
    parent.id,
    count(child.id)::int as total
  from public.roasts as parent
  left join public.roasts as child on child.parent_id = parent.id
  group by parent.id
) as reply_counts
where roasts.id = reply_counts.id
  and roasts.reply_count is distinct from reply_counts.total;

-- Reassert derived vote/comment counters from source-of-truth tables before
-- validating and before the new moderation restore behavior can rely on them.
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
  where roasts.is_deleted = false
  group by roasts.id
) as vote_counts
where roasts.id = vote_counts.roast_id
  and (
    roasts.helpful_votes is distinct from vote_counts.like_count
    or roasts.dislike_count is distinct from vote_counts.dislike_count
  );

update public.roasts
set helpful_votes = 0, dislike_count = 0
where is_deleted = true
  and (helpful_votes <> 0 or dislike_count <> 0);

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
where resumes.id = review_counts.id
  and resumes.roast_count is distinct from review_counts.total;

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
where profiles.id = review_counts.id
  and (
    profiles.roast_count is distinct from review_counts.total
    or profiles.helpful_votes is distinct from review_counts.lint_points
  );

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'resumes_job_description_length'
      and conrelid = 'public.resumes'::regclass
      and not convalidated
  ) then
    alter table public.resumes validate constraint resumes_job_description_length;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'resumes_post_description_length'
      and conrelid = 'public.resumes'::regclass
      and not convalidated
  ) then
    alter table public.resumes validate constraint resumes_post_description_length;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'resume_reads_reader_id_auth_users_fkey'
      and conrelid = 'public.resume_reads'::regclass
      and not convalidated
  ) then
    alter table public.resume_reads validate constraint resume_reads_reader_id_auth_users_fkey;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'roasts_parent_id_fkey'
      and conrelid = 'public.roasts'::regclass
      and not convalidated
  ) then
    alter table public.roasts validate constraint roasts_parent_id_fkey;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'roasts_parent_not_self'
      and conrelid = 'public.roasts'::regclass
      and not convalidated
  ) then
    alter table public.roasts validate constraint roasts_parent_not_self;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_resume_highlight_id_fkey'
      and conrelid = 'public.profiles'::regclass
      and not convalidated
  ) then
    alter table public.profiles validate constraint profiles_resume_highlight_id_fkey;
  end if;
end $$;

create or replace function public.handle_vote_notification_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_roast record;
begin
  if current_setting('app.suppress_vote_notifications', true) = 'on' then
    return new;
  end if;

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

create or replace function public.admin_apply_report_action(
  target_report_id uuid,
  reviewing_admin_user_id uuid,
  report_action text,
  moderation_note text default ''
)
returns table (
  ok boolean,
  error_code text,
  report jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_metadata jsonb := '{}'::jsonb;
  audit_target_id uuid;
  audit_target_type text := 'report';
  current_report record;
  latest_previous_content text;
  latest_previous_votes jsonb := '[]'::jsonb;
  normalized_action text := lower(trim(coalesce(report_action, '')));
  normalized_note text := left(trim(coalesce(moderation_note, '')), 800);
  previous_votes jsonb := '[]'::jsonb;
  next_status text;
  rows_changed int := 0;
  target_profile record;
  target_profile_id uuid;
  target_resume_id uuid;
  target_roast record;
  updated_report record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Admin report actions must use the service role.';
  end if;

  if target_report_id is null then
    ok := false;
    error_code := 'report_not_found';
    report := null;
    return next;
    return;
  end if;

  if reviewing_admin_user_id is null then
    ok := false;
    error_code := 'admin_user_required';
    report := null;
    return next;
    return;
  end if;

  if normalized_action not in (
    'dismiss_report',
    'mark_report_reviewing',
    'mark_report_actioned',
    'remove_roast',
    'restore_roast',
    'close_resume',
    'reopen_resume',
    'reset_reviewer_trust',
    'clear_public_profile_text',
    'clear_reviewer_profile'
  ) then
    ok := false;
    error_code := 'invalid_action';
    report := null;
    return next;
    return;
  end if;

  select
    content_reports.id,
    content_reports.target_type,
    content_reports.resume_id,
    content_reports.roast_id,
    content_reports.profile_id,
    content_reports.reported_user_id,
    content_reports.status,
    content_reports.moderator_note,
    content_reports.report_count
  into current_report
  from public.content_reports
  where content_reports.id = target_report_id
  for update;

  if not found then
    ok := false;
    error_code := 'report_not_found';
    report := null;
    return next;
    return;
  end if;

  next_status := current_report.status;
  audit_target_id := current_report.id;

  if normalized_action = 'dismiss_report' then
    next_status := 'dismissed';
  elsif normalized_action = 'mark_report_reviewing' then
    next_status := 'reviewing';
  elsif normalized_action = 'mark_report_actioned' then
    next_status := 'actioned';
  elsif normalized_action = 'remove_roast' then
    if current_report.roast_id is null then
      ok := false;
      error_code := 'review_target_missing';
      report := null;
      return next;
      return;
    end if;

    audit_target_type := 'roast';
    audit_target_id := current_report.roast_id;
    next_status := 'actioned';

    select
      roasts.id,
      roasts.content,
      roasts.helpful_votes,
      roasts.dislike_count,
      roasts.is_deleted
    into target_roast
    from public.roasts
    where roasts.id = current_report.roast_id
    for update;

    if not found then
      ok := false;
      error_code := 'review_not_found';
      report := null;
      return next;
      return;
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'created_at', votes.created_at,
          'reaction', votes.reaction,
          'voter_id', votes.voter_id
        )
        order by votes.created_at asc, votes.id asc
      ),
      '[]'::jsonb
    )
    into previous_votes
    from public.votes
    where votes.roast_id = current_report.roast_id;

    audit_metadata := jsonb_build_object(
      'previous_content', target_roast.content,
      'previous_dislike_count', coalesce(target_roast.dislike_count, 0),
      'previous_helpful_votes', coalesce(target_roast.helpful_votes, 0),
      'previous_votes', previous_votes,
      'was_deleted', coalesce(target_roast.is_deleted, false)
    );

    if not coalesce(target_roast.is_deleted, false) then
      delete from public.votes
      where votes.roast_id = current_report.roast_id;

      update public.roasts
      set
        content = 'This review was removed by moderation.',
        deleted_at = now(),
        dislike_count = 0,
        helpful_votes = 0,
        is_deleted = true
      where roasts.id = current_report.roast_id;

      get diagnostics rows_changed = row_count;
      if rows_changed <> 1 then
        raise exception 'Review removal failed.';
      end if;
    end if;
  elsif normalized_action = 'restore_roast' then
    if current_report.roast_id is null then
      ok := false;
      error_code := 'review_target_missing';
      report := null;
      return next;
      return;
    end if;

    audit_target_type := 'roast';
    audit_target_id := current_report.roast_id;
    next_status := 'actioned';

    perform 1
    from public.roasts
    where roasts.id = current_report.roast_id
    for update;

    if not found then
      ok := false;
      error_code := 'review_not_found';
      report := null;
      return next;
      return;
    end if;

    select
      moderation_actions.metadata->>'previous_content',
      coalesce(moderation_actions.metadata->'previous_votes', '[]'::jsonb)
    into latest_previous_content, latest_previous_votes
    from public.moderation_actions
    where moderation_actions.action = 'remove_roast'
      and moderation_actions.target_type = 'roast'
      and moderation_actions.target_id = current_report.roast_id
      and coalesce(moderation_actions.metadata->>'was_deleted', 'false') <> 'true'
    order by moderation_actions.created_at desc
    limit 1;

    if nullif(latest_previous_content, '') is null then
      ok := false;
      error_code := 'restore_history_missing';
      report := null;
      return next;
      return;
    end if;

    delete from public.votes
    where votes.roast_id = current_report.roast_id;

    update public.roasts
    set
      content = latest_previous_content,
      deleted_at = null,
      dislike_count = 0,
      helpful_votes = 0,
      is_deleted = false
    where roasts.id = current_report.roast_id;

    get diagnostics rows_changed = row_count;
    if rows_changed <> 1 then
      raise exception 'Review restoration failed.';
    end if;

    perform set_config('app.suppress_vote_notifications', 'on', true);

    insert into public.votes (
      roast_id,
      voter_id,
      reaction,
      created_at
    )
    select
      current_report.roast_id,
      (vote_item->>'voter_id')::uuid,
      case
        when vote_item->>'reaction' in ('like', 'dislike') then vote_item->>'reaction'
        else 'like'
      end,
      coalesce((vote_item->>'created_at')::timestamptz, now())
    from jsonb_array_elements(coalesce(latest_previous_votes, '[]'::jsonb)) as vote_item
    where vote_item->>'voter_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    on conflict (roast_id, voter_id) do update
    set reaction = excluded.reaction;

    perform set_config('app.suppress_vote_notifications', 'off', true);

    audit_metadata := jsonb_build_object(
      'restored_content', true,
      'restored_vote_count', jsonb_array_length(coalesce(latest_previous_votes, '[]'::jsonb))
    );
  elsif normalized_action in ('close_resume', 'reopen_resume') then
    if current_report.resume_id is null then
      ok := false;
      error_code := 'resume_target_missing';
      report := null;
      return next;
      return;
    end if;

    target_resume_id := current_report.resume_id;
    audit_target_type := 'resume';
    audit_target_id := target_resume_id;
    next_status := 'actioned';

    perform 1
    from public.resumes
    where resumes.id = target_resume_id
    for update;

    if not found then
      ok := false;
      error_code := 'resume_not_found';
      report := null;
      return next;
      return;
    end if;

    update public.resumes
    set status = case when normalized_action = 'close_resume' then 'closed' else 'open' end
    where resumes.id = target_resume_id;

    get diagnostics rows_changed = row_count;
    if rows_changed <> 1 then
      raise exception 'Resume moderation update failed.';
    end if;
  elsif normalized_action in (
    'reset_reviewer_trust',
    'clear_public_profile_text',
    'clear_reviewer_profile'
  ) then
    target_profile_id := coalesce(current_report.profile_id, current_report.reported_user_id);

    if target_profile_id is null then
      ok := false;
      error_code := 'profile_target_missing';
      report := null;
      return next;
      return;
    end if;

    audit_target_type := 'profile';
    audit_target_id := target_profile_id;
    next_status := 'actioned';

    select
      profiles.id,
      profiles.tagline,
      profiles.about,
      profiles.skills,
      profiles.community_role,
      profiles.reviewer_type,
      profiles.reviewer_headline,
      profiles.reviewer_bio,
      profiles.reviewer_expertise,
      profiles.reviewer_verification_status
    into target_profile
    from public.profiles
    where profiles.id = target_profile_id
    for update;

    if not found then
      ok := false;
      error_code := 'profile_not_found';
      report := null;
      return next;
      return;
    end if;

    audit_metadata := jsonb_build_object('previous_profile', to_jsonb(target_profile));

    if normalized_action = 'reset_reviewer_trust' then
      update public.profiles
      set
        reviewer_verification_status = 'none',
        reviewer_verified_at = null,
        reviewer_verified_by = null
      where profiles.id = target_profile_id;
    elsif normalized_action = 'clear_public_profile_text' then
      update public.profiles
      set
        about = null,
        skills = '{}'::text[],
        tagline = null
      where profiles.id = target_profile_id;
    else
      update public.profiles
      set
        community_role = 'candidate',
        reviewer_bio = null,
        reviewer_expertise = '{}'::text[],
        reviewer_headline = null,
        reviewer_type = null,
        reviewer_verification_status = 'none',
        reviewer_verified_at = null,
        reviewer_verified_by = null
      where profiles.id = target_profile_id;
    end if;

    get diagnostics rows_changed = row_count;
    if rows_changed <> 1 then
      raise exception 'Profile moderation update failed.';
    end if;
  end if;

  update public.content_reports
  set
    moderator_note = case
      when normalized_note = '' then current_report.moderator_note
      else normalized_note
    end,
    reviewed_at = now(),
    reviewed_by = reviewing_admin_user_id,
    status = next_status
  where content_reports.id = current_report.id
  returning
    content_reports.id,
    content_reports.status
  into updated_report;

  if not found then
    raise exception 'Report moderation update failed.';
  end if;

  insert into public.moderation_actions (
    action,
    admin_user_id,
    metadata,
    reason,
    report_id,
    target_id,
    target_type
  )
  values (
    normalized_action,
    reviewing_admin_user_id,
    audit_metadata,
    normalized_note,
    current_report.id,
    audit_target_id,
    audit_target_type
  );

  ok := true;
  error_code := null;
  report := to_jsonb(updated_report);
  return next;
end;
$$;

revoke all on function public.admin_apply_report_action(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_apply_report_action(uuid, uuid, text, text)
  to service_role;

comment on function public.admin_apply_report_action(uuid, uuid, text, text) is
  'Service-role-only transaction for admin content report decisions, target mutations, audit rows, and lossless review vote restore snapshots.';

notify pgrst, 'reload schema';
