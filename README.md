# BHS OS

Internal operating metrics for Beyond Horizon Solutions. Two users, no roles.

Log flow metrics daily on `/entry`; read trends and bottlenecks on `/dashboard`;
keep state current on `/clients`.

## The modelling rule

**Flow metrics** are things that *happened on a day* and get typed in: leads,
calls booked, calls taken, spend. They live in `daily_leads`.

**State metrics** are things that are *true right now* and are never typed in:
clients under servicing, active projects, MRR. They are derived from `deals` and
`projects`, and updated through `/clients`.

If a number has to be retyped every day, it's memory, not data.

## Setup

1. Create a Supabase project.
2. SQL Editor → run `supabase/schema.sql` (tables, indexes, RLS).
3. SQL Editor → run `supabase/seed.sql` for ~90 days of plausible test data.
   Skip this once you have real data. Re-running it clears all four tables first.
4. Authentication → Users → add the two accounts by email/password.
   Leave signups disabled; there are only ever two of us.
5. Copy `.env.local.example` to `.env.local` and fill in the project URL and
   anon key (Project Settings → API).
6. `npm install && npm run dev`

## Seed data

`supabase/seed.sql` is generated — edit `scripts/generate-seed.mjs` and run
`npm run seed:gen` rather than editing the SQL by hand. Every date is emitted as
`current_date - N`, so the dataset is anchored to whenever you run it and never
goes stale.

## Where the definitions live

Every rate, cost and revenue figure is computed in `src/lib/metrics.ts`. Nothing
else in the app divides two numbers. Change a definition there and it changes
everywhere.

Any metric with a denominator returns `number | null`. `null` means undefined
for this data (zero denominator) and renders as `—`. A zero denominator is not a
zero rate and the dashboard never shows it as one.

### Metric definitions

| Metric | Formula |
| --- | --- |
| Lead→Booked rate | `calls_booked ÷ leads_generated` |
| Show rate | `calls_taken ÷ calls_booked` |
| Close rate | `deals closed ÷ calls_taken` |
| Lead→Close rate | `deals closed ÷ leads_generated` |
| Cost per lead | `spend ÷ leads_generated` |
| Cost per acquisition | `spend ÷ deals closed` |
| MRR (month M) | `Σ monthly_fee` where `close_date ≤ end of M` and (`churn_date` is null or `> end of M`) |
| Churned MRR (month M) | `Σ monthly_fee` for deals with `churn_date` inside M |
| Cash collected (month M) | `Σ setup_fee` closed in M + MRR for M |
| Clients under servicing | count of deals with `status = 'active'` |
| Avg delivery time | `mean(completed_date − start_date)` for projects completed in range |

Deals are attributed to a date range by `close_date`.

**MRR keys off `churn_date`, not `status`** — as specified. A deal set to
`paused` with no churn date still counts toward MRR. To take revenue out, set a
churn date.

## Conventions

- Currency MYR, shown as `RM 1,234`.
- Dates `DD/MM/YYYY` everywhere.
- Weeks start Monday.
- "Today" means today in `Asia/Kuala_Lumpur`, not on the server. Vercel runs UTC;
  without this, anything logged after 8am MYT would land on the wrong date.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth)
· Recharts · deployed on Vercel.

Data fetching happens in server components. Client components are used only
where interaction requires them (the entry grid, chart rendering, table sorting,
inline edits).
