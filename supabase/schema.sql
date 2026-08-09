-- BHS OS — schema
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
--
-- Modelling rule: flow metrics (things that HAPPEN on a day) are typed daily into
-- daily_leads. State metrics (things that are TRUE right now — clients under
-- servicing, active projects, MRR) are derived from deals + projects and are
-- never typed in.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Flow. One row per source per day. Only rows with activity get saved.
create table if not exists daily_leads (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  source text not null check (source in ('xhs','cold','facebook','instagram','tiktok','referral','other')),
  leads_generated int not null default 0,
  calls_booked int not null default 0,
  calls_taken int not null default 0,
  spend_myr numeric(10,2) default 0,   -- ad/tool spend attributable to this source that day
  created_at timestamptz default now(),
  unique (entry_date, source)
);

-- State + conversion record. One row per closed deal.
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  close_date date not null,
  source text not null,                -- same enum as above; enables close-rate by source
  tier text check (tier in ('growth','professional','enterprise','custom')),
  setup_fee_myr numeric(10,2) not null default 0,
  monthly_fee_myr numeric(10,2) not null default 0,
  status text not null default 'active' check (status in ('active','paused','churned')),
  churn_date date,
  notes text,
  created_at timestamptz default now()
);

-- State. One row per client project. Drives all fulfilment metrics.
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

-- Optional freeform daily context, so a spike or dip has an explanation later.
create table if not exists daily_notes (
  entry_date date primary key,
  note text
);

-- Source-of-truth constraint for deals.source, matching daily_leads.source.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deals_source_check'
  ) then
    alter table deals add constraint deals_source_check
      check (source in ('xhs','cold','facebook','instagram','tiktok','referral','other'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes (every dashboard query filters by date)
-- ---------------------------------------------------------------------------

create index if not exists daily_leads_entry_date_idx on daily_leads (entry_date);
create index if not exists deals_close_date_idx       on deals (close_date);
create index if not exists deals_churn_date_idx       on deals (churn_date);
create index if not exists deals_status_idx           on deals (status);
create index if not exists projects_status_idx        on projects (status);
create index if not exists projects_completed_idx     on projects (completed_date);
create index if not exists projects_deal_id_idx       on projects (deal_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Two-person team: any authenticated user gets full access. No per-user isolation.
-- ---------------------------------------------------------------------------

alter table daily_leads enable row level security;
alter table deals       enable row level security;
alter table projects    enable row level security;
alter table daily_notes enable row level security;

drop policy if exists "authenticated full access" on daily_leads;
create policy "authenticated full access" on daily_leads
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on deals;
create policy "authenticated full access" on deals
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on projects;
create policy "authenticated full access" on projects
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on daily_notes;
create policy "authenticated full access" on daily_notes
  for all to authenticated using (true) with check (true);
