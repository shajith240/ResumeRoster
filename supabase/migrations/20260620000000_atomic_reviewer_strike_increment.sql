-- Atomic reviewer strike counter.
-- Replaces the read-modify-write pattern in the cron route with a single UPDATE
-- that returns the new count and whether this increment triggered a new suspension.
-- Callers use the returned values to decide which email to send without a second read.

create or replace function public.increment_reviewer_missed_count(p_reviewer_id uuid)
returns table(new_count integer, is_newly_suspended boolean)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_new_count    integer;
  v_is_suspended boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'increment_reviewer_missed_count requires the service role.';
  end if;

  update public.profiles
  set
    reviewer_missed_count    = reviewer_missed_count + 1,
    reviewer_claim_suspended = case
                                 when reviewer_missed_count + 1 >= 3 then true
                                 else reviewer_claim_suspended
                               end
  where id = p_reviewer_id
  returning reviewer_missed_count, reviewer_claim_suspended
    into v_new_count, v_is_suspended;

  if not found then
    return;
  end if;

  -- is_newly_suspended: true only when the increment crossed exactly to 3
  -- (count was 2 before → now 3 → suspension newly applied)
  return query select v_new_count, (v_new_count = 3 and v_is_suspended);
end;
$$;

revoke execute on function public.increment_reviewer_missed_count(uuid) from public, anon, authenticated;
