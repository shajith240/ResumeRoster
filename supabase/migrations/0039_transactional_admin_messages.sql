-- Linted 0039: transactional, idempotent admin inbox messages.
-- Sends admin system messages through one service-role RPC so broadcasts are
-- all-or-nothing and safe to retry with the same request id.

create unique index if not exists moderation_actions_admin_message_request_id_idx
  on public.moderation_actions ((metadata->>'request_id'))
  where action = 'send_admin_message'
    and metadata ? 'request_id';

create or replace function public.admin_send_message(
  message_request_id uuid,
  sending_admin_user_id uuid,
  sending_admin_email text,
  target_mode text,
  target_user_id uuid,
  message_title text,
  message_body text,
  message_link_href text
)
returns table (
  audit_log_id uuid,
  delivered_count integer,
  failed_count integer,
  skipped_count integer,
  total_recipients integer,
  delivery_status text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_mode text := lower(trim(coalesce(target_mode, '')));
  normalized_title text := trim(coalesce(message_title, ''));
  normalized_body text := trim(coalesce(message_body, ''));
  normalized_link_href text := trim(coalesce(message_link_href, ''));
  target_metadata jsonb;
  message_metadata jsonb;
  existing_audit record;
  existing_status text;
  current_audit_log_id uuid;
  notification_dedupe_key text;
  eligible_recipients integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Admin messaging must use the service role.';
  end if;

  if message_request_id is null then
    raise exception 'Message request id is required.';
  end if;

  if sending_admin_user_id is null then
    raise exception 'Admin user id is required.';
  end if;

  if normalized_mode not in ('all', 'user') then
    raise exception 'Message target is invalid.';
  end if;

  if normalized_mode = 'all' and target_user_id is not null then
    raise exception 'Broadcast messages cannot include a target user.';
  end if;

  if normalized_mode = 'user' and target_user_id is null then
    raise exception 'Target user id is required.';
  end if;

  if char_length(normalized_title) < 1 or char_length(normalized_title) > 80 then
    raise exception 'Message title is invalid.';
  end if;

  if char_length(normalized_body) < 1 or char_length(normalized_body) > 220 then
    raise exception 'Message body is invalid.';
  end if;

  if char_length(normalized_link_href) < 1
    or char_length(normalized_link_href) > 500
    or left(normalized_link_href, 1) <> '/'
    or left(normalized_link_href, 2) = '//'
    or position(E'\\' in normalized_link_href) > 0
    or normalized_link_href ~ '[[:space:]]' then
    raise exception 'Message link is invalid.';
  end if;

  if normalized_mode = 'user' then
    perform 1
    from public.profiles
    where profiles.id = target_user_id;

    if not found then
      raise exception 'User profile not found.';
    end if;
  end if;

  target_metadata := case
    when normalized_mode = 'all' then jsonb_build_object('mode', 'all')
    else jsonb_build_object('mode', 'user', 'userId', target_user_id::text)
  end;
  message_metadata := jsonb_build_object(
    'body', normalized_body,
    'link_href', normalized_link_href,
    'target', target_metadata,
    'title', normalized_title
  );
  notification_dedupe_key := 'admin-message:' || message_request_id::text;

  perform pg_advisory_xact_lock(
    hashtext('admin_send_message'),
    hashtext(message_request_id::text)
  );

  select moderation_actions.id, moderation_actions.metadata
  into existing_audit
  from public.moderation_actions
  where moderation_actions.action = 'send_admin_message'
    and moderation_actions.metadata->>'request_id' = message_request_id::text
  order by moderation_actions.created_at asc
  limit 1
  for update;

  if found then
    if existing_audit.metadata->'admin_message' is distinct from message_metadata then
      audit_log_id := existing_audit.id;
      delivered_count := 0;
      failed_count := 0;
      skipped_count := 0;
      total_recipients := 0;
      delivery_status := 'conflict';
      error_code := 'request_id_reused';
      return next;
      return;
    end if;

    existing_status := existing_audit.metadata->>'delivery_status';
    if existing_status = 'completed' then
      audit_log_id := existing_audit.id;
      delivered_count := coalesce(nullif(existing_audit.metadata->>'delivered_count', '')::integer, 0);
      failed_count := coalesce(nullif(existing_audit.metadata->>'failed_count', '')::integer, 0);
      skipped_count := coalesce(nullif(existing_audit.metadata->>'skipped_count', '')::integer, 0);
      total_recipients := coalesce(nullif(existing_audit.metadata->>'total_recipients', '')::integer, 0);
      delivery_status := 'completed';
      error_code := null;
      return next;
      return;
    end if;

    current_audit_log_id := existing_audit.id;

    update public.moderation_actions
    set metadata = jsonb_strip_nulls(
      coalesce(moderation_actions.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'delivery_status', 'started',
        'error', null,
        'retry_started_at', now()
      )
    )
    where moderation_actions.id = current_audit_log_id;
  else
    insert into public.moderation_actions (
      action,
      admin_user_id,
      metadata,
      reason,
      target_id,
      target_type
    )
    values (
      'send_admin_message',
      sending_admin_user_id,
      jsonb_build_object(
        'admin_message', message_metadata,
        'delivered_count', 0,
        'delivery_status', 'started',
        'failed_count', 0,
        'request_id', message_request_id::text,
        'skipped_count', 0,
        'total_recipients', 0
      ),
      normalized_title,
      case when normalized_mode = 'user' then target_user_id else null end,
      case when normalized_mode = 'all' then 'broadcast' else 'user' end
    )
    returning id into current_audit_log_id;
  end if;

  audit_log_id := current_audit_log_id;

  begin
    with recipients as (
      select profiles.id
      from public.profiles
      where normalized_mode = 'all'
         or profiles.id = target_user_id
    ),
    eligible as (
      select recipients.id
      from recipients
      left join public.notification_preferences
        on notification_preferences.user_id = recipients.id
      where coalesce(notification_preferences.in_app_enabled, true)
        and coalesce(notification_preferences.system_enabled, true)
    ),
    inserted as (
      insert into public.notifications (
        recipient_id,
        actor_id,
        type,
        title,
        body,
        link_href,
        resume_id,
        roast_id,
        parent_roast_id,
        related_user_id,
        metadata,
        dedupe_key,
        read_at,
        seen_at,
        created_at,
        updated_at
      )
      select
        eligible.id,
        null,
        'system',
        normalized_title,
        normalized_body,
        normalized_link_href,
        null,
        null,
        null,
        null,
        jsonb_build_object(
          'admin_email', nullif(trim(coalesce(sending_admin_email, '')), ''),
          'admin_message_id', current_audit_log_id,
          'admin_user_id', sending_admin_user_id,
          'request_id', message_request_id::text
        ),
        notification_dedupe_key,
        null,
        null,
        now(),
        now()
      from eligible
      on conflict (recipient_id, dedupe_key)
        where dedupe_key is not null
      do update
      set
        actor_id = excluded.actor_id,
        type = excluded.type,
        title = excluded.title,
        body = excluded.body,
        link_href = excluded.link_href,
        resume_id = excluded.resume_id,
        roast_id = excluded.roast_id,
        parent_roast_id = excluded.parent_roast_id,
        related_user_id = excluded.related_user_id,
        metadata = excluded.metadata,
        read_at = null,
        seen_at = null,
        created_at = now(),
        updated_at = now()
      returning id
    )
    select
      (select count(*) from recipients)::integer,
      (select count(*) from eligible)::integer,
      (select count(*) from inserted)::integer
    into total_recipients, eligible_recipients, delivered_count;

    skipped_count := greatest(total_recipients - eligible_recipients, 0);
    failed_count := 0;
    delivery_status := 'completed';
    error_code := null;

    update public.moderation_actions
    set metadata = jsonb_strip_nulls(
      jsonb_build_object(
        'admin_message', message_metadata,
        'completed_at', now(),
        'delivered_count', delivered_count,
        'delivery_status', delivery_status,
        'failed_count', failed_count,
        'request_id', message_request_id::text,
        'skipped_count', skipped_count,
        'total_recipients', total_recipients
      )
    )
    where moderation_actions.id = current_audit_log_id;
  exception
    when others then
      delivered_count := 0;
      failed_count := greatest(coalesce(eligible_recipients, 0), 0);
      skipped_count := 0;
      total_recipients := 0;
      delivery_status := 'failed';
      error_code := 'delivery_failed';

      update public.moderation_actions
      set metadata = jsonb_strip_nulls(
        coalesce(moderation_actions.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'delivery_status', delivery_status,
          'error', 'Admin message delivery failed.',
          'failed_at', now(),
          'failed_count', failed_count
        )
      )
      where moderation_actions.id = current_audit_log_id;
  end;

  return next;
end;
$$;

revoke all on function public.admin_send_message(uuid, uuid, text, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_send_message(uuid, uuid, text, text, uuid, text, text, text) to service_role;

notify pgrst, 'reload schema';
