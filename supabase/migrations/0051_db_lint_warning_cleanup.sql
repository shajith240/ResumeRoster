-- Linted 0051: clear warning-level database lint findings before community work.
-- Keeps current behavior while making retained compatibility paths explicit.

create or replace function public.make_linted_username(profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  adjectives text[] := array[
    'bright',
    'calm',
    'clear',
    'steady',
    'kind',
    'keen',
    'wise',
    'bold',
    'brave',
    'fresh',
    'sharp',
    'warm',
    'true',
    'fair',
    'neat',
    'smart',
    'lucid',
    'solid',
    'quick',
    'mellow',
    'curious',
    'patient',
    'honest',
    'gentle',
    'nimble',
    'crafty',
    'golden',
    'sunny',
    'careful',
    'focused',
    'helpful',
    'tidy'
  ];
  nouns text[] := array[
    'mentor',
    'editor',
    'guide',
    'scout',
    'builder',
    'reader',
    'coach',
    'scribe',
    'maker',
    'finder',
    'thinker',
    'helper',
    'advisor',
    'analyst',
    'planner',
    'pilot',
    'curator',
    'reviewer',
    'spark',
    'lens',
    'compass',
    'beacon',
    'anchor',
    'path',
    'draft',
    'signal',
    'proof',
    'polish',
    'craft',
    'notebook',
    'margin',
    'brief'
  ];
  handle_hash text := md5('linted-profile:' || profile_id::text);
  adjective_count int := array_length(adjectives, 1);
  noun_count int := array_length(nouns, 1);
  first_seed int := get_byte(decode(substr(handle_hash, 1, 2), 'hex'), 0);
  second_seed int := get_byte(decode(substr(handle_hash, 3, 2), 'hex'), 0);
  attempt int := 0;
  base_username text;
  candidate text;
  suffix int := 0;
  letter_suffix text;
begin
  while attempt < adjective_count * noun_count loop
    base_username :=
      adjectives[((first_seed + attempt) % adjective_count) + 1]
      || nouns[((second_seed + (attempt * 7)) % noun_count) + 1];
    candidate := left(base_username, 18);

    if not exists (
      select 1
      from public.profiles
      where username = candidate
        and id <> profile_id
    ) then
      return candidate;
    end if;

    attempt := attempt + 1;
  end loop;

  base_username :=
    adjectives[(first_seed % adjective_count) + 1]
    || nouns[(second_seed % noun_count) + 1];

  while suffix < 17576 loop
    letter_suffix :=
      case
        when suffix < 676 then
          chr(97 + (suffix / 26)) || chr(97 + (suffix % 26))
        else
          chr(97 + ((suffix / 676) % 26))
          || chr(97 + ((suffix / 26) % 26))
          || chr(97 + (suffix % 26))
      end;
    candidate := left(base_username, 18 - char_length(letter_suffix)) || letter_suffix;

    if not exists (
      select 1
      from public.profiles
      where username = candidate
        and id <> profile_id
    ) then
      return candidate;
    end if;

    suffix := suffix + 1;
  end loop;

  return 'member' || replace(profile_id::text, '-', '');
end;
$$;

revoke all on function public.make_linted_username(uuid)
  from public, anon, authenticated;

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
  cleaned_target_role text;
  next_current_position text;
begin
  perform coalesce(array_length(expertise_items, 1), 0);

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
    community_role = 'candidate',
    current_position = next_current_position,
    reviewer_type = null,
    target_role = coalesce(cleaned_target_role, public.profiles.target_role),
    reviewer_expertise = '{}'::text[]
  where public.profiles.id = current_user_id;

  return query
  select
    current_user_id,
    selected_goal.id,
    selected_persona.id,
    'completed'::text,
    'candidate'::text,
    null::text;
end;
$$;

revoke all on function public.complete_onboarding(text, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.complete_onboarding(text, text, text, text[])
  to authenticated;

comment on function public.complete_onboarding(text, text, text, text[]) is
  'Completes onboarding without creating a self-declared reviewer profile; expertise_items is retained for RPC compatibility.';

notify pgrst, 'reload schema';
