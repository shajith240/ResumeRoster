-- ResumeRoster 0012: simplify comment media to uploaded images only.
-- Keeps the text/markdown toggle, removes external media attachments from the
-- current data model, and narrows comment uploads to PNG/JPG/WebP.

update public.roasts
set attachment_id = null
where attachment_id in (
  select id
  from public.comment_attachments
  where kind <> 'image'
    or source <> 'upload'
    or storage_path is null
);

delete from public.comment_attachments
where kind <> 'image'
  or source <> 'upload'
  or storage_path is null;

alter table public.comment_attachments
  drop constraint if exists comment_attachments_kind_check,
  drop constraint if exists comment_attachments_source_check,
  drop constraint if exists comment_attachments_shape_check,
  drop constraint if exists comment_attachments_mime_type_check,
  drop constraint if exists comment_attachments_file_size_check,
  drop constraint if exists comment_attachments_title_length_check,
  drop constraint if exists comment_attachments_alt_text_length_check;

alter table public.comment_attachments
  drop column if exists external_url,
  drop column if exists preview_url,
  drop column if exists provider;

update public.comment_attachments
set
  kind = 'image',
  source = 'upload'
where kind <> 'image'
  or source <> 'upload';

alter table public.comment_attachments
  alter column kind set default 'image',
  alter column kind set not null,
  alter column source set default 'upload',
  alter column source set not null;

alter table public.comment_attachments
  add constraint comment_attachments_kind_check
    check (kind = 'image'),
  add constraint comment_attachments_source_check
    check (source = 'upload'),
  add constraint comment_attachments_shape_check
    check (storage_path is not null),
  add constraint comment_attachments_mime_type_check
    check (
      mime_type is null
      or mime_type in ('image/png', 'image/jpeg', 'image/webp')
    ),
  add constraint comment_attachments_file_size_check
    check (file_size is null or (file_size > 0 and file_size <= 3145728)),
  add constraint comment_attachments_title_length_check
    check (char_length(title) <= 120),
  add constraint comment_attachments_alt_text_length_check
    check (char_length(alt_text) <= 180);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comment-media',
  'comment-media',
  true,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 3145728,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

notify pgrst, 'reload schema';
