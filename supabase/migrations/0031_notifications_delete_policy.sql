-- Linted 0031: allow users to dismiss their own in-app notifications.

grant delete on table public.notifications to authenticated;

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications for delete
  to authenticated
  using (recipient_id = auth.uid());
