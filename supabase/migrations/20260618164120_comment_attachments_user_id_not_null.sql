-- Enforce NOT NULL on comment_attachments.user_id.
-- The column was nullable in the original schema but every insert path always
-- provides a user_id. Making it NOT NULL closes a data integrity gap and
-- allows the FK to be relied upon without null checks.

alter table public.comment_attachments alter column user_id set not null;
