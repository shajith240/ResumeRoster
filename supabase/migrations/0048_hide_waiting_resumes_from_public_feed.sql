-- Linted 0048: waiting resumes are private queue items.
-- A waiting resume belongs to its submitter until activation. It should not
-- appear in the public feed or accept public feedback through direct client
-- writes.

drop policy if exists "Visible resumes are publicly readable" on public.resumes;
create policy "Visible resumes are publicly readable"
  on public.resumes for select
  to anon, authenticated
  using (
    auth.uid() = user_id
    or (
      status in ('open', 'closed')
      and review_queue_status = 'active'
    )
  );

drop policy if exists "Roasts are publicly readable" on public.roasts;
create policy "Roasts are publicly readable"
  on public.roasts for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.resumes
      where resumes.id = roasts.resume_id
        and (
          (
            resumes.status in ('open', 'closed')
            and resumes.review_queue_status = 'active'
          )
          or resumes.user_id = auth.uid()
          or roasts.author_id = auth.uid()
        )
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
        and resumes.review_queue_status = 'active'
        and (
          (
            roasts.parent_id is null
            and resumes.user_id <> auth.uid()
          )
          or roasts.parent_id is not null
        )
    )
  );

drop policy if exists "Users can save visible resumes"
  on public.saved_resumes;
create policy "Users can save visible resumes"
  on public.saved_resumes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.resumes
      where resumes.id = saved_resumes.resume_id
        and (
          resumes.user_id = auth.uid()
          or (
            resumes.status in ('open', 'closed')
            and resumes.review_queue_status = 'active'
          )
        )
    )
  );

notify pgrst, 'reload schema';
