-- Linted 0018: map onboarding persona to the public profile role.

create or replace function public.complete_onboarding(
  selected_goal_id text,
  selected_persona_id text,
  target_role_text text default null,
  expertise_items text[] default '{}'::text[]
)
returns table (
  user_id uuid,
  goal_id text,
  persona_id text,
  status text,
  community_role text,
  reviewer_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_goal public.onboarding_goals%rowtype;
  selected_persona public.onboarding_personas%rowtype;
  next_reviewer_type text;
  cleaned_target_role text;
  cleaned_expertise text[];
  next_current_position text;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select *
  into selected_goal
  from public.onboarding_goals
  where id = selected_goal_id;

  if not found then
    raise exception 'Choose a valid onboarding goal.' using errcode = '22023';
  end if;

  select *
  into selected_persona
  from public.onboarding_personas
  where id = selected_persona_id;

  if not found then
    raise exception 'Choose a valid onboarding persona.' using errcode = '22023';
  end if;

  cleaned_target_role := nullif(left(trim(coalesce(target_role_text, '')), 64), '');
  next_current_position := left(trim(selected_persona.label), 64);

  select coalesce(array_agg(item order by first_seen), '{}'::text[])
  into cleaned_expertise
  from (
    select lower(cleaned) as key, min(position) as first_seen, min(cleaned) as item
    from (
      select
        position,
        left(trim(value), 32) as cleaned
      from unnest(coalesce(expertise_items, '{}'::text[]))
        with ordinality as raw_value(value, position)
    ) raw_items
    where char_length(cleaned) between 2 and 32
    group by lower(cleaned)
    order by min(position)
    limit 12
  ) deduped_items;

  if selected_goal.mapped_community_role = 'candidate' then
    next_reviewer_type := null;
    cleaned_expertise := '{}'::text[];
  else
    next_reviewer_type := coalesce(selected_persona.mapped_reviewer_type, 'other');
  end if;

  insert into public.profile_onboarding (
    user_id,
    goal_id,
    persona_id,
    status,
    version,
    completed_at
  )
  values (
    current_user_id,
    selected_goal.id,
    selected_persona.id,
    'completed',
    1,
    now()
  )
  on conflict on constraint profile_onboarding_pkey do update
  set
    goal_id = excluded.goal_id,
    persona_id = excluded.persona_id,
    status = excluded.status,
    version = excluded.version,
    completed_at = excluded.completed_at;

  update public.profiles
  set
    community_role = selected_goal.mapped_community_role,
    current_position = next_current_position,
    reviewer_type = next_reviewer_type,
    target_role = coalesce(cleaned_target_role, public.profiles.target_role),
    reviewer_expertise = cleaned_expertise
  where public.profiles.id = current_user_id;

  return query
  select
    current_user_id,
    selected_goal.id,
    selected_persona.id,
    'completed'::text,
    selected_goal.mapped_community_role,
    next_reviewer_type;
end;
$$;

update public.profiles
set current_position = left(trim(onboarding_personas.label), 64)
from public.profile_onboarding
join public.onboarding_personas
  on onboarding_personas.id = profile_onboarding.persona_id
where profiles.id = profile_onboarding.user_id
  and profile_onboarding.status = 'completed'
  and profile_onboarding.persona_id is not null
  and (
    profiles.current_position is null
    or trim(profiles.current_position) = ''
    or profiles.current_position = profiles.target_role
  );

revoke all on function public.complete_onboarding(text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.complete_onboarding(text, text, text, text[]) to authenticated;

create or replace function public.get_public_profile(profile_id uuid)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  avatar_path text,
  tagline text,
  college text,
  target_role text,
  current_position text,
  college_location text,
  about text,
  skills text[],
  community_role text,
  reviewer_type text,
  reviewer_headline text,
  reviewer_bio text,
  reviewer_expertise text[],
  reviewer_verification_status text,
  reviewer_verified_at timestamptz,
  reviewer_verified_by uuid,
  resume_highlight_id uuid,
  roast_count int,
  helpful_votes int,
  roast_points int,
  resume_improvement int,
  resumes_submitted_count int,
  resumes_roasted_count int,
  best_roast_count int,
  received_roast_count int,
  received_helpful_votes int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with resume_stats as (
    select
      count(*)::int as submitted_count,
      count(*) filter (where status = 'closed')::int as closed_count
    from public.resumes
    where user_id = profile_id
  ),
  received_stats as (
    select
      count(roasts.id)::int as received_roast_count,
      coalesce(sum(roasts.helpful_votes), 0)::int as received_helpful_votes
    from public.resumes
    left join public.roasts
      on roasts.resume_id = resumes.id
      and roasts.is_deleted = false
    where resumes.user_id = profile_id
  ),
  best_roasts as (
    select count(*)::int as best_roast_count
    from (
      select
        roasts.author_id,
        rank() over (
          partition by roasts.resume_id
          order by roasts.helpful_votes desc, roasts.created_at asc
        ) as roast_rank,
        roasts.helpful_votes
      from public.roasts
      where roasts.helpful_votes > 0
        and roasts.is_deleted = false
    ) ranked_roasts
    where ranked_roasts.author_id = profile_id
      and ranked_roasts.roast_rank = 1
  )
  select
    profiles.id,
    profiles.username,
    profiles.full_name,
    profiles.avatar_url,
    profiles.avatar_path,
    profiles.tagline,
    profiles.college,
    profiles.target_role,
    profiles.current_position,
    profiles.college_location,
    profiles.about,
    profiles.skills,
    profiles.community_role,
    profiles.reviewer_type,
    profiles.reviewer_headline,
    profiles.reviewer_bio,
    profiles.reviewer_expertise,
    profiles.reviewer_verification_status,
    profiles.reviewer_verified_at,
    profiles.reviewer_verified_by,
    profiles.resume_highlight_id,
    profiles.roast_count,
    profiles.helpful_votes,
    (profiles.helpful_votes * 120 + profiles.roast_count * 60)::int as roast_points,
    case
      when coalesce(resume_stats.submitted_count, 0) = 0 then 0
      else least(
        96,
        greatest(
          0,
          round(
            (
              coalesce(received_stats.received_roast_count, 0) * 4
              + coalesce(received_stats.received_helpful_votes, 0) * 6
              + coalesce(resume_stats.closed_count, 0) * 10
            )::numeric / greatest(1, coalesce(resume_stats.submitted_count, 0))
          )::int
        )
      )
    end as resume_improvement,
    coalesce(resume_stats.submitted_count, 0)::int as resumes_submitted_count,
    profiles.roast_count as resumes_roasted_count,
    coalesce(best_roasts.best_roast_count, 0)::int as best_roast_count,
    coalesce(received_stats.received_roast_count, 0)::int as received_roast_count,
    coalesce(received_stats.received_helpful_votes, 0)::int as received_helpful_votes,
    profiles.created_at
  from public.profiles
  cross join resume_stats
  cross join received_stats
  cross join best_roasts
  where profiles.id = profile_id
  limit 1;
$$;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
