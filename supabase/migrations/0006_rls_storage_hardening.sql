-- ResumeRoster 0006: RLS, table grants, storage, and RPC hardening.
-- Keeps existing data. This migration tightens who can mutate protected counters,
-- read private resume files, and call security-definer helpers.

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.roasts enable row level security;
alter table public.votes enable row level security;
alter table public.resume_reads enable row level security;
alter table public.app_presence_sessions enable row level security;

-- Clean up invalid legacy profile highlights before enforcing ownership checks.
update public.profiles
set resume_highlight_id = null
where resume_highlight_id is not null
  and not exists (
    select 1
    from public.resumes
    where resumes.id = profiles.resume_highlight_id
      and resumes.user_id = profiles.id
  );

-- Public table grants are intentionally narrow. RLS decides row access; grants
-- decide which columns the browser is allowed to insert or update.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant insert (
  id,
  username,
  full_name,
  avatar_url,
  avatar_path,
  college,
  target_role,
  app_status,
  tagline,
  current_position,
  college_location,
  about,
  skills,
  resume_highlight_id
) on public.profiles to authenticated;
grant update (
  username,
  full_name,
  avatar_url,
  avatar_path,
  college,
  target_role,
  app_status,
  tagline,
  current_position,
  college_location,
  about,
  skills,
  resume_highlight_id
) on public.profiles to authenticated;

revoke all on table public.resumes from anon, authenticated;
grant select on table public.resumes to authenticated;
grant insert (
  user_id,
  title,
  file_path,
  job_description,
  post_description,
  is_anonymous
) on public.resumes to authenticated;
grant update (status) on public.resumes to authenticated;
grant delete on table public.resumes to authenticated;

revoke all on table public.roasts from anon, authenticated;
grant select on table public.roasts to authenticated;
grant insert (
  resume_id,
  parent_id,
  author_id,
  content
) on public.roasts to authenticated;

revoke all on table public.votes from anon, authenticated;
grant select on table public.votes to authenticated;
grant insert (
  roast_id,
  voter_id,
  reaction
) on public.votes to authenticated;
grant update (reaction) on public.votes to authenticated;
grant delete on table public.votes to authenticated;

revoke all on table public.resume_reads from anon, authenticated;
grant select on table public.resume_reads to authenticated;

revoke all on table public.app_presence_sessions from anon, authenticated;

drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (
    auth.uid() = id
    and (
      resume_highlight_id is null
      or exists (
        select 1
        from public.resumes
        where resumes.id = profiles.resume_highlight_id
          and resumes.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (
      resume_highlight_id is null
      or exists (
        select 1
        from public.resumes
        where resumes.id = profiles.resume_highlight_id
          and resumes.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Visible resumes are publicly readable" on public.resumes;
drop policy if exists "Visible resumes are readable by authenticated users" on public.resumes;
create policy "Visible resumes are readable by authenticated users"
  on public.resumes for select
  to authenticated
  using (status in ('open', 'closed') or auth.uid() = user_id);

drop policy if exists "Users can create their own resumes" on public.resumes;
create policy "Users can create their own resumes"
  on public.resumes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own resumes" on public.resumes;
create policy "Users can update their own resumes"
  on public.resumes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own resumes" on public.resumes;
create policy "Users can delete their own resumes"
  on public.resumes for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Roasts are publicly readable" on public.roasts;
drop policy if exists "Roasts are readable by authenticated users" on public.roasts;
create policy "Roasts are readable by authenticated users"
  on public.roasts for select
  to authenticated
  using (
    exists (
      select 1
      from public.resumes
      where resumes.id = roasts.resume_id
        and (resumes.status in ('open', 'closed') or resumes.user_id = auth.uid())
    )
  );

drop policy if exists "Authenticated users can create roasts" on public.roasts;
create policy "Authenticated users can create roasts"
  on public.roasts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and is_deleted = false
    and exists (
      select 1
      from public.resumes
      where resumes.id = roasts.resume_id
        and resumes.status = 'open'
        and (
          (
            roasts.parent_id is null
            and resumes.user_id <> auth.uid()
          )
          or roasts.parent_id is not null
        )
    )
  );

drop policy if exists "Roast authors can update their own roasts" on public.roasts;
drop policy if exists "Roast authors can delete their own roasts" on public.roasts;

drop policy if exists "Votes are readable by authenticated users" on public.votes;
drop policy if exists "Users can read their own votes" on public.votes;
create policy "Users can read their own votes"
  on public.votes for select
  to authenticated
  using (auth.uid() = voter_id);

drop policy if exists "Authenticated users can vote once per roast" on public.votes;
create policy "Authenticated users can vote once per roast"
  on public.votes for insert
  to authenticated
  with check (
    auth.uid() = voter_id
    and exists (
      select 1
      from public.roasts
      join public.resumes on resumes.id = roasts.resume_id
      where roasts.id = votes.roast_id
        and roasts.is_deleted = false
        and resumes.status in ('open', 'closed')
        and roasts.author_id <> auth.uid()
        and resumes.user_id <> auth.uid()
    )
  );

drop policy if exists "Users can change their own votes" on public.votes;
create policy "Users can change their own votes"
  on public.votes for update
  to authenticated
  using (auth.uid() = voter_id)
  with check (
    auth.uid() = voter_id
    and exists (
      select 1
      from public.roasts
      join public.resumes on resumes.id = roasts.resume_id
      where roasts.id = votes.roast_id
        and roasts.is_deleted = false
        and resumes.status in ('open', 'closed')
        and roasts.author_id <> auth.uid()
        and resumes.user_id <> auth.uid()
    )
  );

drop policy if exists "Users can remove their own votes" on public.votes;
create policy "Users can remove their own votes"
  on public.votes for delete
  to authenticated
  using (auth.uid() = voter_id);

drop policy if exists "Users can see their own resume read events" on public.resume_reads;
create policy "Users can see their own resume read events"
  on public.resume_reads for select
  to authenticated
  using (reader_id = auth.uid());

drop policy if exists "Authenticated users can read resume files" on storage.objects;
drop policy if exists "Users can read resumes in their own folder" on storage.objects;
drop policy if exists "Authenticated users can read visible resume files" on storage.objects;
create policy "Authenticated users can read visible resume files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1
      from public.resumes
      where resumes.file_path = storage.objects.name
        and (resumes.status in ('open', 'closed') or resumes.user_id = auth.uid())
    )
  );

drop policy if exists "Users can upload resumes into their own folder" on storage.objects;
create policy "Users can upload resumes into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
    and right(lower(name), 4) = '.pdf'
  );

drop policy if exists "Users can update resumes in their own folder" on storage.objects;

drop policy if exists "Users can delete resumes in their own folder" on storage.objects;
create policy "Users can delete resumes in their own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar files are public" on storage.objects;
create policy "Avatar files are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatars" on storage.objects;
create policy "Users can upload their own avatars"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(name) ~ '\.(jpe?g|png|webp|gif)$'
  );

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(name) ~ '\.(jpe?g|png|webp|gif)$'
  );

drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop function if exists public.increment_roast_helpful_votes();
drop function if exists public.decrement_roast_helpful_votes();

create or replace function public.record_resume_read(target_resume_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  active_user uuid := auth.uid();
  resume_owner uuid;
  inserted_rows int := 0;
  next_count int := 0;
begin
  select user_id, read_count
  into resume_owner, next_count
  from public.resumes
  where id = target_resume_id
    and status in ('open', 'closed');

  if resume_owner is null then
    return 0;
  end if;

  if active_user is null or resume_owner = active_user then
    return coalesce(next_count, 0);
  end if;

  insert into public.resume_reads (resume_id, reader_id)
  values (target_resume_id, active_user)
  on conflict (resume_id, reader_id) do nothing;

  get diagnostics inserted_rows = row_count;

  if inserted_rows > 0 then
    update public.resumes
    set read_count = read_count + 1
    where id = target_resume_id
    returning read_count into next_count;
  else
    select read_count
    into next_count
    from public.resumes
    where id = target_resume_id;
  end if;

  return coalesce(next_count, 0);
end;
$$;

create or replace function public.get_active_roaster_count(
  window_seconds int default 120
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  active_window interval := make_interval(secs => least(greatest(coalesce(window_seconds, 120), 30), 600));
  active_count int;
begin
  delete from public.app_presence_sessions
  where last_seen_at < now() - interval '5 minutes';

  select count(distinct user_id)::int
  into active_count
  from public.app_presence_sessions
  where last_seen_at >= now() - active_window
    and status <> 'offline';

  return coalesce(active_count, 0);
end;
$$;

-- Security-definer functions should not be executable by PUBLIC unless they are
-- intentionally public read APIs.
revoke all on function public.make_unique_username(text, uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.clean_presence_session_id(text) from public, anon, authenticated;
revoke all on function public.validate_roast_parent() from public, anon, authenticated;
revoke all on function public.increment_roast_reply_count() from public, anon, authenticated;
revoke all on function public.decrement_roast_reply_count() from public, anon, authenticated;
revoke all on function public.apply_roast_reaction_delta(uuid, text, int) from public, anon, authenticated;
revoke all on function public.handle_roast_reaction_created() from public, anon, authenticated;
revoke all on function public.handle_roast_reaction_deleted() from public, anon, authenticated;
revoke all on function public.handle_roast_reaction_updated() from public, anon, authenticated;
revoke all on function public.increment_resume_roast_count() from public, anon, authenticated;
revoke all on function public.decrement_resume_roast_count() from public, anon, authenticated;
revoke all on function public.handle_roast_soft_deleted() from public, anon, authenticated;

revoke all on function public.record_resume_read(uuid) from public, anon, authenticated;
grant execute on function public.record_resume_read(uuid) to authenticated;

revoke all on function public.record_app_presence(text, text) from public, anon, authenticated;
grant execute on function public.record_app_presence(text, text) to authenticated;

revoke all on function public.clear_app_presence(text) from public, anon, authenticated;
grant execute on function public.clear_app_presence(text) to authenticated;

revoke all on function public.get_active_roaster_count(int) from public, anon, authenticated;
grant execute on function public.get_active_roaster_count(int) to authenticated;

revoke all on function public.delete_roast(uuid) from public, anon, authenticated;
grant execute on function public.delete_roast(uuid) to authenticated;

revoke all on function public.get_public_profile(uuid) from public, anon, authenticated;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

revoke all on function public.get_public_profile_roasts(uuid, int) from public, anon, authenticated;
grant execute on function public.get_public_profile_roasts(uuid, int) to anon, authenticated;

revoke all on function public.get_public_profile_resumes(uuid, int) from public, anon, authenticated;
grant execute on function public.get_public_profile_resumes(uuid, int) to anon, authenticated;

revoke all on function public.get_roaster_leaderboard(int) from public, anon, authenticated;
grant execute on function public.get_roaster_leaderboard(int) to anon, authenticated;

revoke all on function public.get_auth_email_state(text) from public, anon, authenticated;
grant execute on function public.get_auth_email_state(text) to service_role;

notify pgrst, 'reload schema';
