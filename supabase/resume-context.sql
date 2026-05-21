-- ResumeRoster resume context fields.
-- Run this in the Supabase SQL editor before posting resumes with JD/post context.

alter table public.resumes
  add column if not exists job_description text,
  add column if not exists post_description text;

alter table public.resumes
  drop constraint if exists resumes_job_description_length;

alter table public.resumes
  add constraint resumes_job_description_length
  check (
    job_description is null
    or char_length(job_description) between 20 and 8000
  );

alter table public.resumes
  drop constraint if exists resumes_post_description_length;

alter table public.resumes
  add constraint resumes_post_description_length
  check (
    post_description is null
    or char_length(post_description) between 10 and 4000
  );
