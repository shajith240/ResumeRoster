-- Adds persistent profile status for the account dropdown.
-- Run this in the Supabase SQL editor if status changes do not save.

alter table public.profiles
  add column if not exists app_status text;

update public.profiles
set app_status = 'online'
where app_status is null
  or app_status not in ('online', 'focus', 'offline');

alter table public.profiles
  alter column app_status set default 'online',
  alter column app_status set not null;

alter table public.profiles
  drop constraint if exists profiles_app_status_check;

alter table public.profiles
  add constraint profiles_app_status_check
  check (app_status in ('online', 'focus', 'offline'));
