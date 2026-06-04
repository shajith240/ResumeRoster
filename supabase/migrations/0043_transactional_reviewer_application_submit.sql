-- Linted 0043: transactional reviewer application submission.
-- Keeps reviewer profile state and reviewer_applications in one service-role
-- RPC so failed application upserts cannot leave a profile stuck in pending.

drop function if exists public.submit_reviewer_application(
  uuid,
  text,
  text,
  text[],
  text,
  text,
  text,
  text
);

create or replace function public.submit_reviewer_application(
  target_user_id uuid,
  requested_community_role text,
  requested_reviewer_type text,
  requested_expertise text[] default '{}'::text[],
  requested_proof_url text default '',
  requested_note text default '',
  requested_reviewer_headline text default null,
  requested_reviewer_bio text default null
)
returns table (
  ok boolean,
  error_code text,
  application jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_bio text := nullif(trim(coalesce(requested_reviewer_bio, '')), '');
  normalized_expertise text[] := coalesce(requested_expertise, '{}'::text[]);
  normalized_headline text := nullif(trim(coalesce(requested_reviewer_headline, '')), '');
  normalized_note text := trim(coalesce(requested_note, ''));
  normalized_proof_url text := trim(coalesce(requested_proof_url, ''));
  updated_application record;
  updated_profiles int := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Reviewer applications must use the service role.';
  end if;

  if target_user_id is null then
    ok := false;
    error_code := 'profile_required';
    application := null;
    return next;
    return;
  end if;

  if requested_community_role not in ('reviewer', 'both') then
    ok := false;
    error_code := 'invalid_community_role';
    application := null;
    return next;
    return;
  end if;

  if requested_reviewer_type not in (
    'student',
    'placed_professional',
    'recruiter',
    'hiring_manager',
    'engineer',
    'designer',
    'product_manager',
    'career_coach',
    'founder',
    'other'
  ) then
    ok := false;
    error_code := 'invalid_reviewer_type';
    application := null;
    return next;
    return;
  end if;

  if cardinality(normalized_expertise) > 12 then
    ok := false;
    error_code := 'too_many_expertise';
    application := null;
    return next;
    return;
  end if;

  if char_length(normalized_proof_url) > 240
    or char_length(normalized_note) > 600
    or char_length(coalesce(normalized_headline, '')) > 90
    or char_length(coalesce(normalized_bio, '')) > 280 then
    ok := false;
    error_code := 'details_too_long';
    application := null;
    return next;
    return;
  end if;

  perform 1
  from public.profiles
  where profiles.id = target_user_id
  for update;

  if not found then
    ok := false;
    error_code := 'profile_not_found';
    application := null;
    return next;
    return;
  end if;

  update public.profiles
  set
    community_role = requested_community_role,
    reviewer_bio = normalized_bio,
    reviewer_expertise = normalized_expertise,
    reviewer_headline = normalized_headline,
    reviewer_type = requested_reviewer_type,
    reviewer_verification_status = 'pending',
    reviewer_verified_at = null,
    reviewer_verified_by = null
  where profiles.id = target_user_id;

  get diagnostics updated_profiles = row_count;

  if updated_profiles <> 1 then
    raise exception 'Reviewer profile update failed.';
  end if;

  insert into public.reviewer_applications (
    admin_note,
    expertise,
    note,
    proof_url,
    requested_type,
    reviewed_at,
    reviewed_by,
    status,
    user_id
  )
  values (
    '',
    normalized_expertise,
    normalized_note,
    normalized_proof_url,
    requested_reviewer_type,
    null,
    null,
    'pending',
    target_user_id
  )
  on conflict (user_id) do update
  set
    admin_note = '',
    expertise = excluded.expertise,
    note = excluded.note,
    proof_url = excluded.proof_url,
    requested_type = excluded.requested_type,
    reviewed_at = null,
    reviewed_by = null,
    status = 'pending'
  returning
    reviewer_applications.id,
    reviewer_applications.user_id,
    reviewer_applications.requested_type,
    reviewer_applications.expertise,
    reviewer_applications.proof_url,
    reviewer_applications.note,
    reviewer_applications.status,
    reviewer_applications.admin_note,
    reviewer_applications.reviewed_by,
    reviewer_applications.reviewed_at,
    reviewer_applications.created_at,
    reviewer_applications.updated_at
  into updated_application;

  if not found then
    raise exception 'Reviewer application upsert failed.';
  end if;

  ok := true;
  error_code := null;
  application := to_jsonb(updated_application);
  return next;
end;
$$;

revoke all on function public.submit_reviewer_application(uuid, text, text, text[], text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_reviewer_application(uuid, text, text, text[], text, text, text, text)
  to service_role;

comment on function public.submit_reviewer_application(uuid, text, text, text[], text, text, text, text) is
  'Service-role-only transaction for reviewer application submission and linked profile reviewer state.';

notify pgrst, 'reload schema';
