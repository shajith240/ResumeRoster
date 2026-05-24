-- ResumeRoster 0011: comment media attachments and markdown mode.
-- Pivots roast extras away from curated stickers into normal comment tools:
-- user image upload, provider GIFs, and plain/markdown content format.

create table if not exists public.comment_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  source text not null,
  storage_path text,
  external_url text,
  preview_url text,
  provider text,
  title text not null default '',
  alt_text text not null default '',
  mime_type text,
  file_size int,
  created_at timestamptz not null default now()
);

alter table public.comment_attachments
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists kind text not null default 'image',
  add column if not exists source text not null default 'upload',
  add column if not exists storage_path text,
  add column if not exists external_url text,
  add column if not exists preview_url text,
  add column if not exists provider text,
  add column if not exists title text not null default '',
  add column if not exists alt_text text not null default '',
  add column if not exists mime_type text,
  add column if not exists file_size int,
  add column if not exists created_at timestamptz not null default now();

update public.comment_attachments
set
  kind = case when kind in ('image', 'gif') then kind else 'image' end,
  source = case when source in ('upload', 'gif_provider') then source else 'upload' end,
  title = coalesce(title, ''),
  alt_text = coalesce(alt_text, ''),
  created_at = coalesce(created_at, now());

alter table public.comment_attachments
  alter column kind set default 'image',
  alter column kind set not null,
  alter column source set default 'upload',
  alter column source set not null,
  alter column title set default '',
  alter column title set not null,
  alter column alt_text set default '',
  alter column alt_text set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.comment_attachments
  drop constraint if exists comment_attachments_kind_check,
  drop constraint if exists comment_attachments_source_check,
  drop constraint if exists comment_attachments_shape_check,
  drop constraint if exists comment_attachments_mime_type_check,
  drop constraint if exists comment_attachments_file_size_check,
  drop constraint if exists comment_attachments_title_length_check,
  drop constraint if exists comment_attachments_alt_text_length_check,
  add constraint comment_attachments_kind_check
    check (kind in ('image', 'gif')),
  add constraint comment_attachments_source_check
    check (source in ('upload', 'gif_provider')),
  add constraint comment_attachments_shape_check
    check (
      (
        kind = 'image'
        and source = 'upload'
        and storage_path is not null
        and external_url is null
      )
      or (
        kind = 'gif'
        and source = 'gif_provider'
        and storage_path is null
        and external_url is not null
      )
    ),
  add constraint comment_attachments_mime_type_check
    check (
      mime_type is null
      or mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif')
    ),
  add constraint comment_attachments_file_size_check
    check (file_size is null or (file_size > 0 and file_size <= 3145728)),
  add constraint comment_attachments_title_length_check
    check (char_length(title) <= 120),
  add constraint comment_attachments_alt_text_length_check
    check (char_length(alt_text) <= 180);

create index if not exists comment_attachments_user_created_at_idx
  on public.comment_attachments (user_id, created_at desc);

create unique index if not exists comment_attachments_storage_path_unique_idx
  on public.comment_attachments (storage_path)
  where storage_path is not null;

alter table public.roasts
  add column if not exists attachment_id uuid references public.comment_attachments(id) on delete set null,
  add column if not exists content_format text not null default 'plain';

update public.roasts
set content_format = 'plain'
where content_format is null
  or content_format not in ('plain', 'markdown');

alter table public.roasts
  alter column content_format set default 'plain',
  alter column content_format set not null;

alter table public.roasts
  drop constraint if exists roasts_content_format_check,
  add constraint roasts_content_format_check
    check (content_format in ('plain', 'markdown'));

create index if not exists roasts_attachment_id_idx
  on public.roasts (attachment_id)
  where attachment_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comment-media',
  'comment-media',
  true,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 3145728,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

alter table public.comment_attachments enable row level security;

revoke all on table public.comment_attachments from anon, authenticated;
grant select on table public.comment_attachments to authenticated;

drop policy if exists "Comment attachments are readable by authenticated users" on public.comment_attachments;
create policy "Comment attachments are readable by authenticated users"
  on public.comment_attachments for select
  to authenticated
  using (true);

drop policy if exists "Comment media files are public" on storage.objects;
create policy "Comment media files are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'comment-media');

grant insert (
  resume_id,
  parent_id,
  author_id,
  content,
  attachment_id,
  content_format
) on public.roasts to authenticated;

drop policy if exists "Authenticated users can create roasts" on public.roasts;
create policy "Authenticated users can create roasts"
  on public.roasts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and is_deleted = false
    and content_format in ('plain', 'markdown')
    and sticker_id is null
    and (
      attachment_id is null
      or exists (
        select 1
        from public.comment_attachments
        where comment_attachments.id = roasts.attachment_id
          and comment_attachments.user_id = auth.uid()
      )
    )
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

notify pgrst, 'reload schema';
