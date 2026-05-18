-- Run this after the Step 0 schema if your Supabase project already exists.
-- It tightens public visibility and prevents self-roasts/self-votes.

drop policy if exists "Open resumes are readable by authenticated users" on public.resumes;
drop policy if exists "Open resumes are publicly readable" on public.resumes;
drop policy if exists "Visible resumes are publicly readable" on public.resumes;

create policy "Visible resumes are publicly readable"
  on public.resumes for select
  to anon, authenticated
  using (status in ('open', 'closed') or auth.uid() = user_id);

drop policy if exists "Authenticated users can create roasts" on public.roasts;

create policy "Authenticated users can create roasts"
  on public.roasts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1
      from public.resumes
      where resumes.id = roasts.resume_id
        and resumes.status = 'open'
        and resumes.user_id <> auth.uid()
    )
  );

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
        and roasts.author_id <> auth.uid()
        and resumes.user_id <> auth.uid()
    )
  );
