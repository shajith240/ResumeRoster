-- Linted 0014: profile username defaults for the Linted rebrand.

create or replace function public.make_unique_username(
  base_username text,
  profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  candidate text;
  suffix int := 0;
begin
  normalized := lower(
    regexp_replace(
      coalesce(nullif(trim(base_username), ''), 'reviewer'),
      '[^a-z0-9_-]+',
      '-',
      'g'
    )
  );
  normalized := trim(both '-' from normalized);

  if normalized = '' then
    normalized := 'reviewer';
  end if;

  candidate := left(normalized, 32);

  while exists (
    select 1
    from public.profiles
    where username = candidate
      and id <> profile_id
  ) loop
    suffix := suffix + 1;
    candidate :=
      left(normalized, greatest(1, 32 - char_length(suffix::text) - 1))
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
declare
  display_name text;
  base_username text;
  avatar text;
begin
  display_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  );
  base_username := coalesce(
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username',
    split_part(new.email, '@', 1),
    'reviewer'
  );
  avatar := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture'
  );

  insert into public.profiles (id, full_name, username, avatar_url)
  values (
    new.id,
    display_name,
    public.make_unique_username(base_username, new.id),
    avatar
  )
  on conflict (id) do update
  set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    username = coalesce(public.profiles.username, excluded.username);

  return new;
end;
$$;

notify pgrst, 'reload schema';
