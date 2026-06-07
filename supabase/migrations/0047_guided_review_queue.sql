-- Linted 0047: guided review queue credits.
-- Adds a soft review-to-submit loop without dropping legacy reviewer identity
-- columns. Existing resumes remain active by default.

alter table public.profiles
  add column if not exists review_credit_balance int not null default 0;

update public.profiles
set review_credit_balance = greatest(coalesce(review_credit_balance, 0), 0);

alter table public.profiles
  alter column review_credit_balance set default 0,
  alter column review_credit_balance set not null,
  drop constraint if exists profiles_review_credit_balance_nonnegative,
  add constraint profiles_review_credit_balance_nonnegative
    check (review_credit_balance >= 0);

alter table public.resumes
  add column if not exists review_queue_status text not null default 'active',
  add column if not exists activation_reviews_required int not null default 0,
  add column if not exists activation_reviews_completed int not null default 0;

update public.resumes
set
  review_queue_status = coalesce(review_queue_status, 'active'),
  activation_reviews_required = greatest(coalesce(activation_reviews_required, 0), 0),
  activation_reviews_completed = greatest(coalesce(activation_reviews_completed, 0), 0);

alter table public.resumes
  alter column review_queue_status set default 'active',
  alter column review_queue_status set not null,
  alter column activation_reviews_required set default 0,
  alter column activation_reviews_required set not null,
  alter column activation_reviews_completed set default 0,
  alter column activation_reviews_completed set not null,
  drop constraint if exists resumes_review_queue_status_check,
  drop constraint if exists resumes_activation_reviews_nonnegative,
  drop constraint if exists resumes_activation_reviews_shape_check,
  add constraint resumes_review_queue_status_check
    check (review_queue_status in ('waiting', 'active')),
  add constraint resumes_activation_reviews_nonnegative
    check (activation_reviews_required >= 0 and activation_reviews_completed >= 0),
  add constraint resumes_activation_reviews_shape_check
    check (
      activation_reviews_completed <= activation_reviews_required
      or review_queue_status = 'active'
    );

create index if not exists resumes_review_queue_idx
  on public.resumes (
    review_queue_status,
    roast_count asc,
    created_at desc
  )
  where status = 'open';

alter table public.roasts
  add column if not exists is_guided_review boolean not null default false,
  add column if not exists guided_issue_type text;

update public.roasts
set
  is_guided_review = coalesce(is_guided_review, false),
  guided_issue_type = nullif(trim(coalesce(guided_issue_type, '')), '');

alter table public.roasts
  alter column is_guided_review set default false,
  alter column is_guided_review set not null,
  drop constraint if exists roasts_guided_issue_type_check,
  add constraint roasts_guided_issue_type_check
    check (
      guided_issue_type is null
      or guided_issue_type in (
        'clarity',
        'missing_impact',
        'weak_project',
        'too_generic',
        'ordering',
        'formatting',
        'role_fit'
      )
    );

grant insert (
  guided_issue_type,
  is_guided_review
) on public.roasts to authenticated;

drop function if exists public.create_resume_with_review_queue(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
);

create or replace function public.create_resume_with_review_queue(
  target_user_id uuid,
  resume_title text,
  resume_file_path text,
  resume_is_anonymous boolean,
  resume_privacy_mode text,
  resume_job_description text,
  resume_post_description text
)
returns table (
  id uuid,
  review_queue_status text,
  activation_reviews_required int,
  activation_reviews_completed int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  credits_available int := 0;
  credits_used int := 0;
  required_reviews int := 2;
  next_status text := 'waiting';
begin
  if auth.role() <> 'service_role' then
    raise exception 'Resume queue creation must use the service role.';
  end if;

  select coalesce(profiles.review_credit_balance, 0)
  into credits_available
  from public.profiles
  where profiles.id = target_user_id
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  credits_used := least(greatest(credits_available, 0), required_reviews);
  next_status := case
    when credits_used >= required_reviews then 'active'
    else 'waiting'
  end;

  update public.profiles
  set review_credit_balance = greatest(review_credit_balance - credits_used, 0)
  where profiles.id = target_user_id;

  return query
  insert into public.resumes (
    file_path,
    is_anonymous,
    job_description,
    post_description,
    privacy_mode,
    title,
    user_id,
    review_queue_status,
    activation_reviews_required,
    activation_reviews_completed
  )
  values (
    resume_file_path,
    resume_is_anonymous,
    resume_job_description,
    resume_post_description,
    resume_privacy_mode,
    resume_title,
    target_user_id,
    next_status,
    required_reviews,
    credits_used
  )
  returning
    resumes.id,
    resumes.review_queue_status,
    resumes.activation_reviews_required,
    resumes.activation_reviews_completed;
end;
$$;

revoke all on function public.create_resume_with_review_queue(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.create_resume_with_review_queue(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
) to service_role;

create or replace function public.apply_guided_review_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resume_owner_id uuid;
  target_resume_id uuid;
  target_required int;
  target_completed int;
  next_completed int;
begin
  if not coalesce(new.is_guided_review, false) then
    return new;
  end if;

  if new.parent_id is not null then
    return new;
  end if;

  if new.guided_issue_type not in (
    'clarity',
    'missing_impact',
    'weak_project',
    'too_generic',
    'ordering',
    'formatting',
    'role_fit'
  ) then
    return new;
  end if;

  if char_length(trim(coalesce(new.content, ''))) < 160 then
    return new;
  end if;

  select resumes.user_id
  into resume_owner_id
  from public.resumes
  where resumes.id = new.resume_id;

  if resume_owner_id is null or resume_owner_id = new.author_id then
    return new;
  end if;

  if exists (
    select 1
    from public.roasts
    where roasts.resume_id = new.resume_id
      and roasts.author_id = new.author_id
      and roasts.id <> new.id
      and roasts.parent_id is null
      and coalesce(roasts.is_guided_review, false)
    limit 1
  ) then
    return new;
  end if;

  select
    resumes.id,
    greatest(resumes.activation_reviews_required, 1),
    greatest(resumes.activation_reviews_completed, 0)
  into
    target_resume_id,
    target_required,
    target_completed
  from public.resumes
  where resumes.user_id = new.author_id
    and resumes.status = 'open'
    and resumes.review_queue_status = 'waiting'
  order by resumes.created_at asc
  for update skip locked
  limit 1;

  if target_resume_id is null then
    update public.profiles
    set review_credit_balance = review_credit_balance + 1
    where profiles.id = new.author_id;
    return new;
  end if;

  next_completed := least(target_required, target_completed + 1);

  update public.resumes
  set
    activation_reviews_completed = next_completed,
    review_queue_status = case
      when next_completed >= target_required then 'active'
      else review_queue_status
    end
  where resumes.id = target_resume_id;

  return new;
end;
$$;

drop trigger if exists on_guided_review_credit_created on public.roasts;
create trigger on_guided_review_credit_created
  after insert on public.roasts
  for each row execute procedure public.apply_guided_review_credit();

revoke all on function public.apply_guided_review_credit() from public, anon, authenticated;

comment on function public.create_resume_with_review_queue(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
) is
  'Service-role-only resume insert that atomically consumes guided review credits and assigns the soft queue state.';

comment on function public.apply_guided_review_credit() is
  'Applies one qualifying guided top-level review to the author''s oldest waiting resume, or stores it as future review credit.';

create or replace function public.complete_onboarding(
  selected_goal_id text,
  selected_persona_id text,
  target_role_text text default null,
  expertise_items text[] default '{}'::text[]
)
returns table (
  user_id uuid,
  goal_id text,
  persona_id text,
  status text,
  community_role text,
  reviewer_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_goal public.onboarding_goals%rowtype;
  selected_persona public.onboarding_personas%rowtype;
  cleaned_target_role text;
  next_current_position text;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select *
  into selected_goal
  from public.onboarding_goals
  where id = selected_goal_id;

  if not found then
    raise exception 'Choose a valid onboarding goal.' using errcode = '22023';
  end if;

  select *
  into selected_persona
  from public.onboarding_personas
  where id = selected_persona_id;

  if not found then
    raise exception 'Choose a valid onboarding persona.' using errcode = '22023';
  end if;

  cleaned_target_role := nullif(left(trim(coalesce(target_role_text, '')), 64), '');
  next_current_position := left(trim(selected_persona.label), 64);

  insert into public.profile_onboarding (
    user_id,
    goal_id,
    persona_id,
    status,
    version,
    completed_at
  )
  values (
    current_user_id,
    selected_goal.id,
    selected_persona.id,
    'completed',
    1,
    now()
  )
  on conflict on constraint profile_onboarding_pkey do update
  set
    goal_id = excluded.goal_id,
    persona_id = excluded.persona_id,
    status = excluded.status,
    version = excluded.version,
    completed_at = excluded.completed_at;

  update public.profiles
  set
    community_role = 'candidate',
    current_position = next_current_position,
    reviewer_type = null,
    target_role = coalesce(cleaned_target_role, public.profiles.target_role),
    reviewer_expertise = '{}'::text[]
  where public.profiles.id = current_user_id;

  return query
  select
    current_user_id,
    selected_goal.id,
    selected_persona.id,
    'completed'::text,
    'candidate'::text,
    null::text;
end;
$$;

revoke all on function public.complete_onboarding(text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.complete_onboarding(text, text, text, text[]) to authenticated;

comment on function public.complete_onboarding(text, text, text, text[]) is
  'Completes onboarding without creating a self-declared reviewer profile; participation goals only affect routing and onboarding state.';

notify pgrst, 'reload schema';
