-- ResumeRoster 0009: privacy modes and server-side resume upload enforcement.

alter table public.resumes
  add column if not exists privacy_mode text not null default 'anonymous';

update public.resumes
set privacy_mode = case
  when is_anonymous then 'anonymous'
  else 'public'
end
where privacy_mode is null
  or privacy_mode not in ('public', 'contact_hidden', 'anonymous');

alter table public.resumes
  drop constraint if exists resumes_privacy_mode_check;

alter table public.resumes
  add constraint resumes_privacy_mode_check
  check (privacy_mode in ('public', 'contact_hidden', 'anonymous'));

drop policy if exists "Users can create their own resumes" on public.resumes;

drop policy if exists "Users can upload resumes into their own folder" on storage.objects;

notify pgrst, 'reload schema';
