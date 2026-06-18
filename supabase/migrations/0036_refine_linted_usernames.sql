-- Linted 0036: shorter generated profile usernames.
-- Keeps privacy-first defaults while replacing hash-heavy handles with
-- short, readable, letter-only names.

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

  loop
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
end;
$$;

update public.profiles
set username = public.make_linted_username(id)
where username is null
   or trim(username) = ''
   or username ~ '^[a-z]+-[a-z]+-[a-f0-9]{10}$';

revoke all on function public.make_linted_username(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
