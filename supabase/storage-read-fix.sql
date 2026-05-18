-- Run this once if a signed-in user can roast but cannot open another user's resume PDF.
-- The bucket stays private; this only allows authenticated users to create signed URLs.

drop policy if exists "Users can read resumes in their own folder" on storage.objects;
drop policy if exists "Authenticated users can read resume files" on storage.objects;

create policy "Authenticated users can read resume files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
  );
