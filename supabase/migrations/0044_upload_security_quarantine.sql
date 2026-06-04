-- Linted 0044: upload malware scanning and quarantine.
-- Uploads now pass through server-side validation/scanning before reaching
-- public or user-visible storage buckets. Blocked uploads are isolated here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'upload-quarantine',
  'upload-quarantine',
  false,
  5242880,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create table if not exists public.upload_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  upload_kind text not null,
  original_name text not null default '',
  storage_bucket text,
  storage_path text,
  mime_type text not null,
  file_size int not null,
  sha256 text not null,
  scanner text not null default 'unknown',
  verdict text not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.upload_security_events
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists upload_kind text not null default 'resume',
  add column if not exists original_name text not null default '',
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text not null default 'application/octet-stream',
  add column if not exists file_size int not null default 0,
  add column if not exists sha256 text not null default repeat('0', 64),
  add column if not exists scanner text not null default 'unknown',
  add column if not exists verdict text not null default 'unscanned',
  add column if not exists reason text,
  add column if not exists created_at timestamptz not null default now();

alter table public.upload_security_events
  alter column upload_kind drop default,
  alter column mime_type drop default,
  alter column file_size drop default,
  alter column sha256 drop default,
  alter column verdict drop default,
  drop constraint if exists upload_security_events_upload_kind_check,
  drop constraint if exists upload_security_events_verdict_check,
  drop constraint if exists upload_security_events_file_size_check,
  drop constraint if exists upload_security_events_sha256_check,
  drop constraint if exists upload_security_events_storage_shape_check,
  add constraint upload_security_events_upload_kind_check
    check (upload_kind in ('avatar', 'comment-media', 'resume')),
  add constraint upload_security_events_verdict_check
    check (verdict in ('clean', 'infected', 'scanner_error', 'suspicious', 'unscanned')),
  add constraint upload_security_events_file_size_check
    check (file_size > 0 and file_size <= 5242880),
  add constraint upload_security_events_sha256_check
    check (sha256 ~ '^[0-9a-f]{64}$'),
  add constraint upload_security_events_storage_shape_check
    check (
      (storage_bucket is null and storage_path is null)
      or (storage_bucket = 'upload-quarantine' and storage_path is not null)
    );

create index if not exists upload_security_events_created_at_idx
  on public.upload_security_events (created_at desc);

create index if not exists upload_security_events_user_created_at_idx
  on public.upload_security_events (user_id, created_at desc);

create index if not exists upload_security_events_verdict_created_at_idx
  on public.upload_security_events (verdict, created_at desc);

alter table public.upload_security_events enable row level security;

revoke all on table public.upload_security_events from anon, authenticated;

drop policy if exists "Users can upload resumes into their own folder" on storage.objects;
drop policy if exists "Users can update resumes in their own folder" on storage.objects;
drop policy if exists "Users can upload their own avatars" on storage.objects;
drop policy if exists "Users can update their own avatars" on storage.objects;
drop policy if exists "Users can delete their own avatars" on storage.objects;

comment on table public.upload_security_events is
  'Private audit trail for upload malware scanning and quarantine decisions.';

comment on column public.upload_security_events.storage_bucket is
  'Set only when a blocked upload was copied into the private upload-quarantine bucket.';

notify pgrst, 'reload schema';
