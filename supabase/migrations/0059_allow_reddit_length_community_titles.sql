-- Linted 0059: match Reddit-style 300 character post titles.
-- Keep the minimum title quality bar, but allow the same 300 character title
-- budget shown in the create-post composer.

alter table public.community_posts
  drop constraint if exists community_posts_title_length_check,
  add constraint community_posts_title_length_check
    check (char_length(title) between 8 and 300);

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef(
    'public.submit_community_post(uuid, uuid, text, text, text, text[], jsonb)'::regprocedure
  )
  into function_sql;

  function_sql := replace(
    function_sql,
    'char_length(cleaned_title) > 180',
    'char_length(cleaned_title) > 300'
  );
  function_sql := replace(
    function_sql,
    'between 8 and 180 characters',
    'between 8 and 300 characters'
  );

  execute function_sql;

  select pg_get_functiondef(
    'public.update_community_post_content(uuid, uuid, text, text)'::regprocedure
  )
  into function_sql;

  function_sql := replace(
    function_sql,
    'char_length(cleaned_title) > 180',
    'char_length(cleaned_title) > 300'
  );
  function_sql := replace(
    function_sql,
    'between 8 and 180 characters',
    'between 8 and 300 characters'
  );

  execute function_sql;
end $$;

comment on function public.submit_community_post(uuid, uuid, text, text, text, text[], jsonb) is
  'Service-role-only community post creation contract with Reddit-length titles, optional body text, media, and crowd-control status.';

notify pgrst, 'reload schema';
