-- Linted 0033: privacy-first profile defaults.
-- New users should start with a neutral Linted handle, not OAuth names,
-- email local-parts, provider usernames, or provider avatars.

create or replace function public.make_linted_username(profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  adjectives text[] := array[
    'focused',
    'thoughtful',
    'sharp',
    'steady',
    'curious',
    'practical',
    'candid',
    'helpful',
    'precise',
    'patient',
    'bright',
    'calm',
    'clear',
    'driven',
    'honest',
    'keen'
  ];
  nouns text[] := array[
    'reviewer',
    'editor',
    'mentor',
    'analyst',
    'builder',
    'coach',
    'scout',
    'writer',
    'helper',
    'planner',
    'navigator',
    'advisor',
    'strategist',
    'observer',
    'guide',
    'reader'
  ];
  handle_hash text := md5('linted-profile:' || profile_id::text);
  adjective text;
  noun text;
  base_username text;
  candidate text;
  suffix int := 0;
begin
  adjective := adjectives[(get_byte(decode(substr(handle_hash, 1, 2), 'hex'), 0) % array_length(adjectives, 1)) + 1];
  noun := nouns[(get_byte(decode(substr(handle_hash, 3, 2), 'hex'), 0) % array_length(nouns, 1)) + 1];
  base_username := adjective || '-' || noun || '-' || substr(handle_hash, 1, 10);
  candidate := left(base_username, 32);

  while exists (
    select 1
    from public.profiles
    where username = candidate
      and id <> profile_id
  ) loop
    suffix := suffix + 1;
    candidate :=
      left(base_username, greatest(1, 32 - char_length(suffix::text) - 1))
      || '-' || suffix::text;
  end loop;

  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, avatar_url)
  values (
    new.id,
    null,
    public.make_linted_username(new.id),
    null
  )
  on conflict (id) do update
  set
    username = coalesce(public.profiles.username, excluded.username);

  return new;
end;
$$;

update public.profiles
set username = public.make_linted_username(id)
where username is null
   or trim(username) = '';

revoke all on function public.make_linted_username(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

notify pgrst, 'reload schema';
