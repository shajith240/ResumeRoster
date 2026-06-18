-- Linted 0041: indexed admin people search.
-- Keeps admin user search complete and paginated without fetching arbitrary
-- profile windows or calling the Auth Admin API once per candidate user.
-- Email search data is copied into an app-owned private table so the query does
-- not depend on indexes or REST access against Supabase-managed auth tables.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.admin_user_auth_index (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  auth_created_at timestamptz,
  last_sign_in_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.admin_user_auth_index enable row level security;
revoke all on table public.admin_user_auth_index
  from public, anon, authenticated;

create index if not exists admin_user_auth_index_email_search_trgm_idx
  on public.admin_user_auth_index
  using gin ((lower(coalesce(email, ''))) extensions.gin_trgm_ops);

create index if not exists profiles_admin_user_search_trgm_idx
  on public.profiles
  using gin ((
    lower(
      coalesce(username, '') || ' ' ||
      coalesce(full_name, '') || ' ' ||
      coalesce(reviewer_headline, '') || ' ' ||
      coalesce(current_position, '') || ' ' ||
      coalesce(reviewer_verification_status, '') || ' ' ||
      coalesce(community_role, '')
    )
  ) extensions.gin_trgm_ops);

create index if not exists profiles_admin_user_search_created_at_idx
  on public.profiles (created_at desc, id);

create or replace function public.sync_admin_user_auth_index()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.admin_user_auth_index (
    user_id,
    email,
    auth_created_at,
    last_sign_in_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    new.created_at,
    new.last_sign_in_at,
    now()
  )
  on conflict (user_id) do update
    set email = excluded.email,
        auth_created_at = excluded.auth_created_at,
        last_sign_in_at = excluded.last_sign_in_at,
        updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all on function public.sync_admin_user_auth_index()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_admin_search_sync on auth.users;
create trigger on_auth_user_admin_search_sync
  after insert or update of email, last_sign_in_at on auth.users
  for each row execute procedure public.sync_admin_user_auth_index();

insert into public.admin_user_auth_index (
  user_id,
  email,
  auth_created_at,
  last_sign_in_at,
  updated_at
)
select
  users.id,
  users.email,
  users.created_at,
  users.last_sign_in_at,
  now()
from auth.users
on conflict (user_id) do update
  set email = excluded.email,
      auth_created_at = excluded.auth_created_at,
      last_sign_in_at = excluded.last_sign_in_at,
      updated_at = excluded.updated_at;

create or replace function public.admin_search_users(
  search_query text,
  page_number integer default 1,
  page_size integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_query text := lower(trim(coalesce(search_query, '')));
  escaped_query text;
  search_pattern text;
  normalized_page_size integer := least(greatest(coalesce(page_size, 10), 1), 25);
  requested_page integer := greatest(coalesce(page_number, 1), 1);
  total_rows bigint := 0;
  last_page integer := 1;
  current_page integer := 1;
  row_offset integer := 0;
  users_json jsonb := '[]'::jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Admin user search must use the service role.';
  end if;

  if normalized_query = '' then
    return jsonb_build_object(
      'page', 1,
      'perPage', normalized_page_size,
      'total', 0,
      'users', '[]'::jsonb
    );
  end if;

  escaped_query := replace(normalized_query, '\', '\\');
  escaped_query := replace(escaped_query, '%', '\%');
  escaped_query := replace(escaped_query, '_', '\_');
  search_pattern := '%' || escaped_query || '%';

  select count(*)
  into total_rows
  from public.profiles as profile_rows
  join public.admin_user_auth_index as auth_index
    on auth_index.user_id = profile_rows.id
  where lower(coalesce(auth_index.email, '')) like search_pattern escape '\'
    or lower(
      coalesce(profile_rows.username, '') || ' ' ||
      coalesce(profile_rows.full_name, '') || ' ' ||
      coalesce(profile_rows.reviewer_headline, '') || ' ' ||
      coalesce(profile_rows.current_position, '') || ' ' ||
      coalesce(profile_rows.reviewer_verification_status, '') || ' ' ||
      coalesce(profile_rows.community_role, '')
    ) like search_pattern escape '\';

  if total_rows > 0 then
    last_page := ceil(total_rows::numeric / normalized_page_size)::integer;
    current_page := least(requested_page, last_page);
    row_offset := (current_page - 1) * normalized_page_size;
  end if;

  with matched_users as (
    select
      profile_rows.id,
      profile_rows.username,
      profile_rows.full_name,
      profile_rows.avatar_url,
      profile_rows.college,
      profile_rows.target_role,
      profile_rows.current_position,
      profile_rows.app_status,
      profile_rows.community_role,
      profile_rows.reviewer_type,
      profile_rows.reviewer_headline,
      profile_rows.reviewer_verification_status,
      profile_rows.roast_count,
      profile_rows.helpful_votes,
      profile_rows.created_at as profile_created_at,
      auth_index.email,
      auth_index.auth_created_at,
      auth_index.last_sign_in_at
    from public.profiles as profile_rows
    join public.admin_user_auth_index as auth_index
      on auth_index.user_id = profile_rows.id
    where lower(coalesce(auth_index.email, '')) like search_pattern escape '\'
      or lower(
        coalesce(profile_rows.username, '') || ' ' ||
        coalesce(profile_rows.full_name, '') || ' ' ||
        coalesce(profile_rows.reviewer_headline, '') || ' ' ||
        coalesce(profile_rows.current_position, '') || ' ' ||
        coalesce(profile_rows.reviewer_verification_status, '') || ' ' ||
        coalesce(profile_rows.community_role, '')
      ) like search_pattern escape '\'
    order by profile_rows.created_at desc, profile_rows.id
    limit normalized_page_size
    offset row_offset
  ),
  resume_counts as (
    select resumes.user_id, count(*)::integer as total
    from public.resumes
    join matched_users
      on matched_users.id = resumes.user_id
    group by resumes.user_id
  ),
  review_counts as (
    select roasts.author_id, count(*)::integer as total
    from public.roasts
    join matched_users
      on matched_users.id = roasts.author_id
    group by roasts.author_id
  ),
  vote_counts as (
    select votes.voter_id, count(*)::integer as total
    from public.votes
    join matched_users
      on matched_users.id = votes.voter_id
    group by votes.voter_id
  ),
  attachment_counts as (
    select comment_attachments.user_id, count(*)::integer as total
    from public.comment_attachments
    join matched_users
      on matched_users.id = comment_attachments.user_id
    group by comment_attachments.user_id
  ),
  report_counts as (
    select content_reports.reporter_id, count(*)::integer as total
    from public.content_reports
    join matched_users
      on matched_users.id = content_reports.reporter_id
    group by content_reports.reporter_id
  ),
  application_counts as (
    select reviewer_applications.user_id, count(*)::integer as total
    from public.reviewer_applications
    join matched_users
      on matched_users.id = reviewer_applications.user_id
    group by reviewer_applications.user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', matched_users.id,
        'email', matched_users.email,
        'created_at', matched_users.auth_created_at,
        'last_sign_in_at', matched_users.last_sign_in_at,
        'profile', jsonb_build_object(
          'id', matched_users.id,
          'username', matched_users.username,
          'full_name', matched_users.full_name,
          'avatar_url', matched_users.avatar_url,
          'college', matched_users.college,
          'target_role', matched_users.target_role,
          'current_position', matched_users.current_position,
          'app_status', matched_users.app_status,
          'community_role', matched_users.community_role,
          'reviewer_type', matched_users.reviewer_type,
          'reviewer_headline', matched_users.reviewer_headline,
          'reviewer_verification_status', matched_users.reviewer_verification_status,
          'roast_count', matched_users.roast_count,
          'helpful_votes', matched_users.helpful_votes,
          'created_at', matched_users.profile_created_at
        ),
        'dataFootprint', jsonb_build_object(
          'attachments', coalesce(attachment_counts.total, 0),
          'reportsFiled', coalesce(report_counts.total, 0),
          'resumes', coalesce(resume_counts.total, 0),
          'reviewerApplications', coalesce(application_counts.total, 0),
          'reviews', coalesce(review_counts.total, 0),
          'votes', coalesce(vote_counts.total, 0)
        )
      )
      order by matched_users.profile_created_at desc, matched_users.id
    ),
    '[]'::jsonb
  )
  into users_json
  from matched_users
  left join resume_counts
    on resume_counts.user_id = matched_users.id
  left join review_counts
    on review_counts.author_id = matched_users.id
  left join vote_counts
    on vote_counts.voter_id = matched_users.id
  left join attachment_counts
    on attachment_counts.user_id = matched_users.id
  left join report_counts
    on report_counts.reporter_id = matched_users.id
  left join application_counts
    on application_counts.user_id = matched_users.id;

  return jsonb_build_object(
    'page', current_page,
    'perPage', normalized_page_size,
    'total', total_rows,
    'users', users_json
  );
end;
$$;

revoke all on function public.admin_search_users(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_search_users(text, integer, integer)
  to service_role;

comment on function public.admin_search_users(text, integer, integer) is
  'Service-role-only indexed search for the admin people page, including auth email, profile fields, pagination, and per-page footprint counts.';

comment on table public.admin_user_auth_index is
  'Private service-side index of auth email metadata used for scalable admin people search.';

notify pgrst, 'reload schema';
