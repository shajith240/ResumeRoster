-- Linted 0045: authenticated API route rate limits.
-- Adds a service-role-only RPC for Next.js API routes that perform expensive
-- authenticated work outside direct table triggers.

create or replace function public.check_authenticated_action_rate_limit(
  target_user_id uuid,
  target_action text,
  window_seconds int,
  max_requests int
)
returns table (
  allowed boolean,
  remaining int,
  retry_after_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Authenticated API rate limits must use the service role.';
  end if;

  if target_user_id is null then
    raise exception 'Rate limit user is required.';
  end if;

  return query
  select
    limit_row.allowed,
    limit_row.remaining,
    limit_row.retry_after_seconds
  from public.check_rate_limit(
    encode(extensions.digest('user:' || target_user_id::text, 'sha256'), 'hex'),
    target_action,
    window_seconds,
    max_requests
  ) as limit_row;
end;
$$;

revoke all on function public.check_authenticated_action_rate_limit(uuid, text, int, int)
  from public, anon, authenticated;
grant execute on function public.check_authenticated_action_rate_limit(uuid, text, int, int)
  to service_role;

comment on function public.check_authenticated_action_rate_limit(uuid, text, int, int) is
  'Service-role-only DB-backed quota for expensive authenticated API routes: resume_pdf_submit, comment_media_upload, avatar_upload, reviewer_application_submit, and push_subscription_write.';

comment on table public.request_rate_limits is
  'Private DB-backed rate limit buckets for authenticated writes and expensive API actions.';

notify pgrst, 'reload schema';
