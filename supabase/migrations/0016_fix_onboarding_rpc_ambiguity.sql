-- Linted 0016: remove ambiguous user_id reference from onboarding RPC.

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

revoke all on function public.complete_onboarding(text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.complete_onboarding(text, text, text, text[]) to authenticated;

notify pgrst, 'reload schema';
