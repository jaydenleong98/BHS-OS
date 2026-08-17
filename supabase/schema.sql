-- BHS OS — schema
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- It is idempotent: safe to re-run after a pull.
--
-- The modelling rule:
--
--   Records are entities that move through states — prospects, clients,
--   projects. Every funnel number in the app is a COUNT of these, derived, never
--   typed in.
--
--   Effort is the small number of things I do each day that no record can infer:
--   outreach attempts, conversations started, calls taken, deep work blocks.
--   Four numbers. That is the entire daily typing surface.
--
--   Configuration is targets and ceilings, set once in Settings.
--
-- If a number has to be retyped every day, it is memory, not data.

-- ---------------------------------------------------------------------------
-- Retired tables
--
-- daily_leads held typed-in aggregates (leads/booked/taken/spend per source per
-- day). Source now lives on the prospect and the funnel is derived, so the table
-- has no meaning left. daily_notes folded into daily_activity.
-- ---------------------------------------------------------------------------

drop table if exists daily_leads;
drop table if exists daily_notes;

-- ---------------------------------------------------------------------------
-- Clients
--
-- Physically still called `deals` — the row IS the client record, created when a
-- prospect is marked won. Renaming it would break nothing but history, so the
-- name stays and the app calls it a Client everywhere a human can see.
-- ---------------------------------------------------------------------------

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  close_date date not null,               -- the day it was won
  source text not null,
  tier text check (tier in ('growth','professional','enterprise','custom')),
  setup_fee_myr numeric(10,2) not null default 0,
  monthly_fee_myr numeric(10,2) not null default 0,
  status text not null default 'active' check (status in ('active','paused','churned')),
  churn_date date,
  notes text,
  created_at timestamptz default now()
);

-- Relationship state. All set by hand on /clients; none of it is inferable.
alter table deals add column if not exists go_live_date date;
alter table deals add column if not exists delivery_pain int;
alter table deals add column if not exists delivery_pain_updated_on date;
alter table deals add column if not exists last_contact_on date;
alter table deals add column if not exists referral_asked_on date;
alter table deals add column if not exists billing_terms_confirmed boolean not null default false;
alter table deals add column if not exists billing_terms_confirmed_on date;

do $$
begin
  alter table deals drop constraint if exists deals_source_check;
  alter table deals add constraint deals_source_check check (source in
    ('xhs','facebook','instagram','tiktok','blog','website','referral','cold','networking','other'));

  alter table deals drop constraint if exists deals_delivery_pain_check;
  alter table deals add constraint deals_delivery_pain_check
    check (delivery_pain is null or delivery_pain between 1 and 5);
end $$;

-- ---------------------------------------------------------------------------
-- Prospects — the record everything in the funnel is counted from
--
-- Source lives here, on the entity, not on a day. One date column per stage: the
-- day that transition first happened. Stage-length and sales-cycle reporting read
-- these columns, and every funnel count is "rows whose <stage>_on falls in range".
-- ---------------------------------------------------------------------------

create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null check (source in
    ('xhs','facebook','instagram','tiktok','blog','website','referral','cold','networking','other')),
  -- Set when source = 'referral': the client who made the introduction.
  referred_by_client_id uuid references deals(id) on delete set null,

  stage text not null default 'new' check (stage in
    ('new','conversation','call_booked','call_taken','proposal','won','lost')),

  new_on          date not null,
  conversation_on date,
  booked_on       date,
  taken_on        date,
  proposal_on     date,
  won_on          date,
  lost_on         date,

  est_setup_fee_myr   numeric(10,2) not null default 0,
  est_monthly_fee_myr numeric(10,2) not null default 0,

  lost_reason text,
  notes text,

  -- The client record created when this prospect was won.
  client_id uuid references deals(id) on delete set null,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Projects — one per build. Drives every fulfilment metric.
-- ---------------------------------------------------------------------------

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete set null,
  project_name text not null,
  start_date date not null,
  target_date date,
  completed_date date,
  status text not null default 'in_progress'
    check (status in ('not_started','in_progress','blocked','completed')),
  notes text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Effort — my four daily numbers, and Vaneese's two weekly ones
--
-- A row existing means the day was logged. All-zero is a real, complete answer
-- and must be storable, so unlike the old table nothing here is deleted-when-empty.
-- ---------------------------------------------------------------------------

create table if not exists daily_activity (
  entry_date date primary key,
  outreach int not null default 0,
  conversations int not null default 0,
  sales_calls int not null default 0,
  deep_work_blocks int not null default 0,
  note text,
  created_at timestamptz default now()
);

create table if not exists weekly_content (
  week_start date primary key,            -- always a Monday
  content_posted int not null default 0,
  blog_posts int not null default 0,
  note text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Ad spend — monthly, not daily. Only ever read on the Analysis tab.
-- ---------------------------------------------------------------------------

create table if not exists monthly_spend (
  month text not null,                    -- 'YYYY-MM'
  source text not null check (source in
    ('xhs','facebook','instagram','tiktok','blog','website','referral','cold','networking','other')),
  spend_myr numeric(10,2) not null default 0,
  created_at timestamptz default now(),
  primary key (month, source)
);

-- ---------------------------------------------------------------------------
-- Referral asks — one row per ask. The dashboard counts this month's.
-- ---------------------------------------------------------------------------

create table if not exists referral_asks (
  id uuid primary key default gen_random_uuid(),
  asked_on date not null,
  client_id uuid references deals(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Onboarding checklist — the step list lives in code (lib/types.ts), so adding a
-- step never needs a migration. A row here means "this step, this client, done".
-- ---------------------------------------------------------------------------

create table if not exists onboarding_progress (
  client_id uuid references deals(id) on delete cascade,
  step_key text not null,
  done_on date not null default current_date,
  created_at timestamptz default now(),
  primary key (client_id, step_key)
);

-- ---------------------------------------------------------------------------
-- Settings — one row, targets and ceilings. Nothing here is seeded with a
-- plausible-looking number: target MRR starts at 0 and the dashboard says so
-- until it is set.
-- ---------------------------------------------------------------------------

create table if not exists app_settings (
  id text primary key default 'singleton' check (id = 'singleton'),
  target_mrr_myr numeric(10,2) not null default 0,
  goal_deadline date,                     -- null = 31 Dec of the current year
  active_build_ceiling int not null default 3,
  close_to_live_target_days int not null default 14,
  content_target_per_week int not null default 7,
  blog_target_per_week int not null default 2,
  outreach_target_per_day int not null default 10,
  conversations_target_per_day int not null default 3,
  deep_work_target_per_day int not null default 2,
  updated_at timestamptz default now()
);

insert into app_settings (id) values ('singleton') on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Indexes — every dashboard query filters by one of these dates.
-- ---------------------------------------------------------------------------

create index if not exists prospects_stage_idx      on prospects (stage);
create index if not exists prospects_new_idx        on prospects (new_on);
create index if not exists prospects_won_idx        on prospects (won_on);
create index if not exists prospects_source_idx     on prospects (source);
create index if not exists prospects_referrer_idx   on prospects (referred_by_client_id);
create index if not exists deals_close_date_idx     on deals (close_date);
create index if not exists deals_churn_date_idx     on deals (churn_date);
create index if not exists deals_status_idx         on deals (status);
create index if not exists projects_status_idx      on projects (status);
create index if not exists projects_completed_idx   on projects (completed_date);
create index if not exists projects_deal_id_idx     on projects (deal_id);
create index if not exists referral_asks_date_idx   on referral_asks (asked_on);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Two-person team: any authenticated user gets full access. No per-user isolation.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'deals','prospects','projects','daily_activity','weekly_content',
    'monthly_spend','referral_asks','onboarding_progress','app_settings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated full access" on %I', t);
    execute format(
      'create policy "authenticated full access" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
