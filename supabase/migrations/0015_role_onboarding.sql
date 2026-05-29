-- Linted 0015: normalized role onboarding for first-run personalization.
-- Roles personalize the experience only; they do not restrict who can review.

create table if not exists public.onboarding_goals (
  id text primary key,
  label text not null,
  description text not null,
  mapped_community_role text not null,
  display_order int not null,
  created_at timestamptz not null default now(),
  constraint onboarding_goals_community_role_check
    check (mapped_community_role in ('candidate', 'reviewer', 'both')),
  constraint onboarding_goals_label_length_check
    check (char_length(label) between 2 and 80),
  constraint onboarding_goals_description_length_check
    check (char_length(description) between 2 and 220)
);

create table if not exists public.onboarding_personas (
  id text primary key,
  label text not null,
  description text not null,
  mapped_reviewer_type text,
  display_order int not null,
  created_at timestamptz not null default now(),
  constraint onboarding_personas_reviewer_type_check
    check (
      mapped_reviewer_type is null
      or mapped_reviewer_type in (
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
      )
    ),
  constraint onboarding_personas_label_length_check
    check (char_length(label) between 2 and 80),
  constraint onboarding_personas_description_length_check
    check (char_length(description) between 2 and 220)
);

insert into public.onboarding_goals (
  id,
  label,
  description,
  mapped_community_role,
  display_order
)
values
  ('get_feedback', 'Get feedback', 'Post a resume and learn which fixes matter before applying.', 'candidate', 10),
  ('review_resumes', 'Review resumes', 'Help others by catching weak bullets, unclear proof, and recruiter red flags.', 'reviewer', 20),
  ('both', 'Do both', 'Get feedback on your own resume and review resumes from the community.', 'both', 30)
on conflict (id) do update
set
  label = excluded.label,
  description = excluded.description,
  mapped_community_role = excluded.mapped_community_role,
  display_order = excluded.display_order;

insert into public.onboarding_personas (
  id,
  label,
  description,
  mapped_reviewer_type,
  display_order
)
values
  ('student', 'Student', 'I am preparing for internships, placements, or early-career roles.', 'student', 10),
  ('new_grad', 'New grad', 'I am moving from college into my first full-time role.', null, 20),
  ('job_seeker', 'Job seeker', 'I am actively applying and want a clearer resume.', null, 30),
  ('career_switcher', 'Career switcher', 'I am changing roles, domains, or industries.', null, 40),
  ('recruiter_hr', 'Recruiter / HR', 'I screen resumes or support hiring pipelines.', 'recruiter', 50),
  ('hiring_manager', 'Hiring manager', 'I evaluate candidates or make hiring decisions.', 'hiring_manager', 60),
  ('engineer', 'Engineer', 'I can review technical projects, proof, and role fit.', 'engineer', 70),
  ('designer', 'Designer', 'I can review design portfolios, UX proof, and presentation.', 'designer', 80),
  ('product_manager', 'Product manager', 'I can review product, strategy, and impact signals.', 'product_manager', 90),
  ('career_coach', 'Career coach', 'I help people position their career story.', 'career_coach', 100),
  ('founder', 'Founder', 'I hire, mentor, or review from a startup operator lens.', 'founder', 110),
  ('other', 'Other', 'I do not fit one label yet.', null, 120)
on conflict (id) do update
set
  label = excluded.label,
  description = excluded.description,
  mapped_reviewer_type = excluded.mapped_reviewer_type,
  display_order = excluded.display_order;

create table if not exists public.profile_onboarding (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  goal_id text references public.onboarding_goals(id),
  persona_id text references public.onboarding_personas(id),
  status text not null default 'pending',
  version int not null default 1,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_onboarding_status_check
    check (status in ('pending', 'completed', 'not_required')),
  constraint profile_onboarding_version_check
    check (version > 0),
  constraint profile_onboarding_completion_shape_check
    check (
      (
        status = 'completed'
        and goal_id is not null
        and persona_id is not null
        and completed_at is not null
      )
      or (
        status <> 'completed'
        and completed_at is null
      )
    )
);

alter table public.profile_onboarding
  add column if not exists goal_id text references public.onboarding_goals(id),
  add column if not exists persona_id text references public.onboarding_personas(id),
  add column if not exists status text not null default 'pending',
  add column if not exists version int not null default 1,
  add column if not exists completed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  drop constraint if exists profile_onboarding_status_check,
  drop constraint if exists profile_onboarding_version_check,
  drop constraint if exists profile_onboarding_completion_shape_check,
  add constraint profile_onboarding_status_check
    check (status in ('pending', 'completed', 'not_required')),
  add constraint profile_onboarding_version_check
    check (version > 0),
  add constraint profile_onboarding_completion_shape_check
    check (
      (
        status = 'completed'
        and goal_id is not null
        and persona_id is not null
        and completed_at is not null
      )
      or (
        status <> 'completed'
        and completed_at is null
      )
    );

insert into public.profile_onboarding (user_id, status, version)
select profiles.id, 'not_required', 1
from public.profiles
where not exists (
  select 1
  from public.profile_onboarding
  where profile_onboarding.user_id = profiles.id
);

create index if not exists profile_onboarding_status_updated_at_idx
  on public.profile_onboarding (status, updated_at desc);

alter table public.onboarding_goals enable row level security;
alter table public.onboarding_personas enable row level security;
alter table public.profile_onboarding enable row level security;

grant select on table public.onboarding_goals to anon, authenticated;
grant select on table public.onboarding_personas to anon, authenticated;
revoke all on table public.profile_onboarding from anon, authenticated;
grant select on table public.profile_onboarding to authenticated;

drop policy if exists "Onboarding goals are readable" on public.onboarding_goals;
create policy "Onboarding goals are readable"
  on public.onboarding_goals for select
  to anon, authenticated
  using (true);

drop policy if exists "Onboarding personas are readable" on public.onboarding_personas;
create policy "Onboarding personas are readable"
  on public.onboarding_personas for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can read their own onboarding state" on public.profile_onboarding;
create policy "Users can read their own onboarding state"
  on public.profile_onboarding for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.touch_profile_onboarding_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profile_onboarding_updated on public.profile_onboarding;
create trigger on_profile_onboarding_updated
  before update on public.profile_onboarding
  for each row execute procedure public.touch_profile_onboarding_updated_at();

create or replace function public.create_pending_profile_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_onboarding (user_id, status, version)
  values (new.id, 'pending', 1)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_profile_created_pending_onboarding on public.profiles;
create trigger on_profile_created_pending_onboarding
  after insert on public.profiles
  for each row execute procedure public.create_pending_profile_onboarding();

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
  next_reviewer_type text;
  cleaned_target_role text;
  cleaned_expertise text[];
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

  select coalesce(array_agg(item order by first_seen), '{}'::text[])
  into cleaned_expertise
  from (
    select lower(cleaned) as key, min(position) as first_seen, min(cleaned) as item
    from (
      select
        position,
        left(trim(value), 32) as cleaned
      from unnest(coalesce(expertise_items, '{}'::text[]))
        with ordinality as raw_value(value, position)
    ) raw_items
    where char_length(cleaned) between 2 and 32
    group by lower(cleaned)
    order by min(position)
    limit 12
  ) deduped_items;

  if selected_goal.mapped_community_role = 'candidate' then
    next_reviewer_type := null;
    cleaned_expertise := '{}'::text[];
  else
    next_reviewer_type := coalesce(selected_persona.mapped_reviewer_type, 'other');
  end if;

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
  on conflict (user_id) do update
  set
    goal_id = excluded.goal_id,
    persona_id = excluded.persona_id,
    status = excluded.status,
    version = excluded.version,
    completed_at = excluded.completed_at;

  update public.profiles
  set
    community_role = selected_goal.mapped_community_role,
    reviewer_type = next_reviewer_type,
    target_role = coalesce(cleaned_target_role, target_role),
    reviewer_expertise = cleaned_expertise
  where profiles.id = current_user_id;

  return query
  select
    current_user_id,
    selected_goal.id,
    selected_persona.id,
    'completed'::text,
    selected_goal.mapped_community_role,
    next_reviewer_type;
end;
$$;

revoke all on function public.touch_profile_onboarding_updated_at() from public, anon, authenticated;
revoke all on function public.create_pending_profile_onboarding() from public, anon, authenticated;
revoke all on function public.complete_onboarding(text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.complete_onboarding(text, text, text, text[]) to authenticated;

notify pgrst, 'reload schema';
