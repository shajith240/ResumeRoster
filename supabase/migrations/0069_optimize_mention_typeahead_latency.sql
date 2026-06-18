-- Linted 0069: lower latency mention typeahead.
-- Short prefixes are too broad for trigram contains search, so route 1-2
-- character queries through prefix indexes only. Longer queries keep fuzzy
-- contains matching and relevance ranking.

create or replace function public.search_mentionable_profiles(
  search_query text,
  result_limit integer default 8,
  excluded_user_id uuid default null
)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  current_position text,
  reviewer_headline text,
  community_role text,
  roast_count integer,
  helpful_votes integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  normalized_query text :=
    lower(trim(regexp_replace(coalesce(search_query, ''), '\s+', ' ', 'g')));
  normalized_handle text;
  escaped_query text;
  escaped_handle text;
  contains_pattern text;
  handle_prefix_pattern text;
  name_prefix_pattern text;
  bounded_limit integer := least(greatest(coalesce(result_limit, 8), 1), 12);
  allow_contains_search boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Mention profile search must use the service role.';
  end if;

  normalized_handle := regexp_replace(
    regexp_replace(normalized_query, '^@+', ''),
    '[^a-z0-9_.-]',
    '',
    'g'
  );

  if normalized_query = '' and normalized_handle = '' then
    return;
  end if;

  allow_contains_search :=
    char_length(normalized_query) >= 3
    or char_length(normalized_handle) >= 3;

  escaped_query := replace(normalized_query, '\', '\\');
  escaped_query := replace(escaped_query, '%', '\%');
  escaped_query := replace(escaped_query, '_', '\_');

  escaped_handle := replace(normalized_handle, '\', '\\');
  escaped_handle := replace(escaped_handle, '%', '\%');
  escaped_handle := replace(escaped_handle, '_', '\_');

  contains_pattern := '%' || escaped_query || '%';
  handle_prefix_pattern := escaped_handle || '%';
  name_prefix_pattern := escaped_query || '%';

  return query
  with candidate_profiles as (
    select
      profile_rows.id,
      profile_rows.username,
      profile_rows.full_name,
      profile_rows.avatar_url,
      profile_rows.current_position,
      profile_rows.reviewer_headline,
      profile_rows.community_role,
      coalesce(profile_rows.roast_count, 0)::integer as roast_count,
      coalesce(profile_rows.helpful_votes, 0)::integer as helpful_votes,
      profile_rows.created_at,
      lower(coalesce(profile_rows.username, '')) as username_key,
      lower(coalesce(profile_rows.full_name, '')) as full_name_key
    from public.profiles as profile_rows
    where (excluded_user_id is null or profile_rows.id <> excluded_user_id)
      and (
        lower(coalesce(profile_rows.username, '')) like handle_prefix_pattern escape '\'
        or lower(coalesce(profile_rows.full_name, '')) like name_prefix_pattern escape '\'
        or (
          allow_contains_search
          and lower(
            coalesce(profile_rows.username, '') || ' ' ||
            coalesce(profile_rows.full_name, '') || ' ' ||
            coalesce(profile_rows.current_position, '') || ' ' ||
            coalesce(profile_rows.reviewer_headline, '')
          ) like contains_pattern escape '\'
        )
      )
  )
  select
    candidate_profiles.id,
    candidate_profiles.username,
    candidate_profiles.full_name,
    candidate_profiles.avatar_url,
    candidate_profiles.current_position,
    candidate_profiles.reviewer_headline,
    candidate_profiles.community_role,
    candidate_profiles.roast_count,
    candidate_profiles.helpful_votes,
    candidate_profiles.created_at
  from candidate_profiles
  order by
    case
      when normalized_handle <> '' and candidate_profiles.username_key = normalized_handle then 0
      when normalized_handle <> '' and candidate_profiles.username_key like handle_prefix_pattern escape '\' then 1
      when candidate_profiles.full_name_key like name_prefix_pattern escape '\' then 2
      else 3
    end,
    greatest(
      case
        when normalized_handle = '' then 0
        else extensions.similarity(candidate_profiles.username_key, normalized_handle)
      end,
      extensions.similarity(candidate_profiles.full_name_key, normalized_query)
    ) desc,
    (candidate_profiles.helpful_votes * 2 + candidate_profiles.roast_count) desc,
    candidate_profiles.created_at desc,
    candidate_profiles.id
  limit bounded_limit;
end;
$$;

comment on function public.search_mentionable_profiles(text, integer, uuid) is
  'Service-role-only indexed profile search for bounded @mention autocomplete. Short prefixes use prefix indexes only; longer queries add fuzzy contains matching.';

notify pgrst, 'reload schema';
