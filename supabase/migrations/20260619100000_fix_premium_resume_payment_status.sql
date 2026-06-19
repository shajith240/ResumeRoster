-- Fix: create_premium_resume now sets payment_status='paid' immediately.
--
-- The HMAC signature (orderId|paymentId, signed with RAZORPAY_KEY_SECRET) is
-- verified by the caller (/api/payments/verify) before this function runs.
-- Razorpay only produces that signature on a captured payment, so 'paid' is
-- correct at insert time. The webhook (payment.captured) becomes a no-op
-- backup rather than the sole path to claimability.
--
-- This eliminates the stuck-pending failure mode: if the webhook is delayed
-- or dropped, the resume is immediately claimable after the client verifies.

create or replace function public.create_premium_resume(
  target_user_id          uuid,
  resume_title            text,
  resume_file_path        text,
  resume_is_anonymous     boolean,
  resume_privacy_mode     text,
  resume_job_description  text,
  resume_post_description text,
  p_payment_id            text,
  p_razorpay_order_id     text
)
returns table (id uuid)
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'create_premium_resume requires the service role.';
  end if;

  return query
  insert into public.resumes (
    file_path,
    is_anonymous,
    is_premium,
    job_description,
    payment_id,
    payment_status,
    post_description,
    privacy_mode,
    razorpay_order_id,
    review_queue_status,
    title,
    user_id,
    activation_reviews_required,
    activation_reviews_completed
  )
  values (
    resume_file_path,
    resume_is_anonymous,
    true,
    resume_job_description,
    p_payment_id,
    'paid',
    resume_post_description,
    resume_privacy_mode,
    p_razorpay_order_id,
    'active',
    resume_title,
    target_user_id,
    0,
    0
  )
  returning resumes.id;
end;
$$;

-- Grants unchanged — still service_role only.
revoke execute on function public.create_premium_resume(uuid, text, text, boolean, text, text, text, text, text) from public, anon, authenticated;
