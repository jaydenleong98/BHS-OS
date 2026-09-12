-- Sales Hub — schema
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
--
-- This rebuilds BHS OS as a personal sales-activity hub: a daily log, a script
-- and objection-handling library, and a trend dashboard. Everything from the
-- old client-ops version (pipeline, clients, revenue, settings) is dropped.

-- ---------------------------------------------------------------------------
-- Retired tables — the old CRM/revenue model. Dropping these deletes their data.
-- ---------------------------------------------------------------------------

drop table if exists onboarding_progress;
drop table if exists referral_asks;
drop table if exists monthly_spend;
drop table if exists weekly_content;
drop table if exists projects;
drop table if exists prospects;
drop table if exists deals;
drop table if exists app_settings;

-- ---------------------------------------------------------------------------
-- Daily activity — the whole daily typing surface. A row existing means the
-- day was logged; all-zero is a real, complete answer, so nothing here is
-- deleted-when-empty.
-- ---------------------------------------------------------------------------

create table if not exists daily_activity (
  entry_date date primary key,
  outreach int not null default 0,
  follow_up int not null default 0,
  meetings_booked int not null default 0,
  meetings_attended int not null default 0,
  note text,
  created_at timestamptz default now()
);

-- Migrate an existing daily_activity table from the old schema, if present.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'daily_activity' and column_name = 'conversations') then
    alter table daily_activity rename column conversations to follow_up;
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'daily_activity' and column_name = 'sales_calls') then
    alter table daily_activity rename column sales_calls to meetings_booked;
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'daily_activity' and column_name = 'deep_work_blocks') then
    alter table daily_activity rename column deep_work_blocks to meetings_attended;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Scripts — the sales script and objection-handling library. Two categories,
-- freeform title + body, ordered by creation.
-- ---------------------------------------------------------------------------

create table if not exists scripts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('script', 'objection')),
  title text not null,
  body text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists scripts_category_idx on scripts (category, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Solo use: any authenticated user gets full access. No per-user isolation.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['daily_activity', 'scripts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated full access" on %I', t);
    execute format(
      'create policy "authenticated full access" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
