-- Linted 0071: enforce free-MVP static image limits across community media.
-- This follow-up is intentionally idempotent so databases that already applied
-- an earlier 0070 are moved to the final PNG/JPG/WebP-only contract.

alter table public.comment_attachments
  drop constraint if exists comment_attachments_mime_type_check,
  drop constraint if exists comment_attachments_file_size_check;

alter table public.comment_attachments
  add constraint comment_attachments_mime_type_check
    check (
      mime_type is null
      or mime_type in ('image/png', 'image/jpeg', 'image/webp')
    ),
  add constraint comment_attachments_file_size_check
    check (file_size is null or (file_size > 0 and file_size <= 2097152));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comment-media',
  'comment-media',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

alter table public.community_post_attachments
  drop constraint if exists community_post_attachments_mime_type_check,
  drop constraint if exists community_post_attachments_file_size_check;

alter table public.community_post_attachments
  add constraint community_post_attachments_mime_type_check
    check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  add constraint community_post_attachments_file_size_check
    check (file_size > 0 and file_size <= 2097152);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-post-media',
  'community-post-media',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

notify pgrst, 'reload schema';
