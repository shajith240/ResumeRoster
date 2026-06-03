-- Linted 0034: keep admin account deletion from tripping user-facing rate limits.
-- Supabase Auth deletes run outside a normal signed-in user context. If profile
-- deletion cascades into votes or saved resumes, these guards must allow the
-- maintenance delete instead of raising "Sign in to continue."

create or replace function public.guard_vote_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE'
    and (auth.uid() is null or auth.role() = 'service_role') then
    return old;
  end if;

  perform public.enforce_authenticated_rate_limit('vote_write', 300, 120);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.guard_saved_resume_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE'
    and (auth.uid() is null or auth.role() = 'service_role') then
    return old;
  end if;

  perform public.enforce_authenticated_rate_limit('saved_resume_write', 300, 80);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_vote_write_rate_limit() from public, anon, authenticated;
revoke all on function public.guard_saved_resume_rate_limit() from public, anon, authenticated;

notify pgrst, 'reload schema';
