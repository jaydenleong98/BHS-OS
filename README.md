# BHS OS

Internal operating metrics for Beyond Horizon Solutions. Two users, no roles.

It is not an ad performance tool. It exists to answer one question — **how far off
the MRR goal am I, and what has to happen to close it** — and everything else on
the screen is context for that.

Six pages: log effort on `/entry`, move deals on `/pipeline`, read the goal on
`/dashboard`, dig into ratios on `/analysis`, keep state current on `/clients`,
set targets on `/settings`.

## The modelling rule

**Records** are entities that move through states — prospects, clients, builds.
Every funnel number in the app is a *count* of these. None of it is typed in.

**Effort** is the handful of things I do each day that no record can infer:
outreach, conversations started, sales calls taken, deep work blocks. Four
numbers. Plus Vaneese's two weekly ones. That is the entire typing surface.

**Configuration** is targets and ceilings, set once on `/settings`.

If a number has to be retyped every day, it's memory, not data.

### Source lives on the prospect

This is the change the app was rebuilt around. Source used to live on a *day* —
a 28-cell grid of leads/booked/taken/spend per source, typed in every morning.
Now a prospect is created once, carries its own source, and is moved through
stages by hand. Leads, calls booked, calls taken, closes and every source
breakdown are derived from those records.

Source appears nowhere on the entry page, and no funnel figure anywhere in the
app is enterable as an aggregate.

## Setup

1. Create a Supabase project.
2. SQL Editor → run `supabase/schema.sql` (tables, indexes, RLS). It is
   idempotent, and drops the retired `daily_leads` / `daily_notes` tables.
3. Authentication → Users → add the two accounts by email/password.
   Leave signups disabled; there are only ever two of us.
4. Copy `.env.local.example` to `.env.local` and fill in the project URL and
   anon key (Project Settings → API).
5. `npm install && npm run dev`
6. Open `/settings` and set the target MRR. Until then the dashboard says
   "no target set" rather than inventing one.

There is no seed data and no seed generator. The app ships empty on purpose — a
demo number that looks real is worse than no number. If you are staring at
leftover data from an earlier version, `/settings` → **Start clean** deletes every
prospect, client, build, entry, spend row and referral ask in one go and keeps
only your targets.

### Preview mode (no Supabase)

To look at the UI before there's a project to point at, put this in `.env.local`
instead of the two Supabase keys and run `npm run dev`:

```
NEXT_PUBLIC_PREVIEW_DATA=1
```

Auth is bypassed and every query is served from `src/lib/preview/` — an in-memory
table set that starts **empty**. Whatever you type in during the session is all
it will show, and it is gone on restart.

It is a way to see the app, not a way to run it. Never set this flag on a
deployment: it would hand the whole UI to anyone who loads the page.

## The pages

**`/entry`** — four number fields, one optional note, one save button. Under 60
seconds. No totals, no rates, no summary at the top: entry and review are
different jobs and mixing them is what made the old page unopenable. A second tab
holds Vaneese's weekly content numbers, on its own table, so she never touches
the daily page.

Blank counts as zero, and saving an all-zero day still counts as a logged day —
"I did nothing today" is a complete answer, and the streak has to be able to tell
it apart from a day I forgot.

**`/pipeline`** — one card per prospect across five open stages. The button on the
card face advances it; the only two transitions that open a form are **won**
(actual fees, go-live date) and **lost** (a reason, required). Marking a prospect
won creates the client and the build automatically. There is no other way to
create a client: one with no prospect behind it would have no source and no sales
cycle to measure.

**`/dashboard`** — the goal gap first and largest, then the funnel in counts,
content and referrals, fulfilment capacity, and revenue.

**`/analysis`** — every ratio, every cost, every per-source breakdown, and the
monthly ad spend entry. Deliberately a separate page.

**`/clients`** — the register, plus the relationship state that nothing can infer:
delivery pain, last contact, referral asks, billing confirmation, onboarding
checklist.

**`/settings`** — targets, ceilings, and the wipe.

## Where the definitions live

Every rate, cost and revenue figure is computed in `src/lib/metrics.ts`, where
`safeDiv` is the only division used to compute a metric. Change a definition
there and it changes everywhere.

Division does appear elsewhere, but never for a metric: a bar's width percentage,
thousands-scaling on a chart axis, rounding, milliseconds to days. Each is
guarded at its call site.

Any metric with a denominator returns `number | null`. `null` means undefined for
this data (zero denominator) and renders as `—`. A zero denominator is not a zero
rate and the dashboard never shows it as one.

### Metric definitions

| Metric | Formula |
| --- | --- |
| Funnel stage count | prospects whose `<stage>_on` falls in range |
| MRR gap | `max(0, target_mrr − current MRR)` |
| Closes needed | `ceil(gap ÷ mean monthly fee of billing clients)` |
| Weeks to feed pipeline | whole weeks until `deadline − average sales cycle` |
| Average sales cycle | `mean(won_on − new_on)` over every prospect ever won |
| Pace | closes/month over the trailing 90 days vs `closes needed ÷ months left` |
| Weighted pipeline | `Σ est_monthly_fee × stage weight` over open prospects |
| MRR (month M) | `Σ monthly_fee` where `close_date ≤ end of M` and (`churn_date` is null or `> end of M`) |
| Churned MRR (month M) | `Σ monthly_fee` for clients with `churn_date` inside M |
| Cash collected (month M) | `Σ setup_fee` won in M + MRR for M |
| Active builds | projects with status `in_progress` or `blocked` |
| Avg close to live | `mean(go_live_date − close_date)` for clients live in range |
| Avg delivery time | `mean(completed_date − start_date)` for builds completed in range |
| Onboarding completion | done checklist steps ÷ total steps, averaged over active clients |
| Show rate *(Analysis only)* | calls taken ÷ calls booked |
| Close rate *(Analysis only)* | won ÷ calls taken |
| Cost per prospect *(Analysis only)* | spend ÷ prospects added |
| Cost per acquisition *(Analysis only)* | spend ÷ clients won |

Clients are attributed to a date range by `close_date`.

**MRR keys off `churn_date`, not `status`.** A client set to `paused` with no
churn date still counts toward MRR. To take revenue out, set a churn date.

## Things worth knowing

**No conversion percentage appears on the dashboard.** At six to eight closes a
year, a stage-to-stage ratio swings by tens of points on a single event. Those
numbers read as insight and behave as noise, so they live on `/analysis` with a
90-day default range and a warning printed under them. The old bottleneck badge
is gone for the same reason.

**Stage dates are stamped forward, never backward.** Moving a prospect to a stage
also stamps every earlier stage that was never stamped — skipping from New
straight to Proposal still means a conversation happened, and the funnel would
lie if the intermediate counts stayed empty. An already-stamped date is never
rewritten, so each column records the *first* time that stage was reached and
moving a card backwards does not rewrite history.

**Won is one-way from the pipeline.** Once a prospect has a client record, the
card can't be dragged back or deleted — that revenue has an owner now. Churn the
client on `/clients` instead.

**Active builds is the one number where more is worse.** It has a configurable
ceiling (default 3), renders amber at the ceiling and red above it, and prints
"pause selling" rather than leaving the colour to carry it.

**Ad spend is monthly.** A range that covers part of a month counts that month's
spend whole. Stated rather than pro-rated: pro-rating would invent daily
precision the input never had.

**There is no per-source colour.** Ten sources cannot make a colourblind-safe
categorical palette on this surface — measured, not assumed, and folding four
real channels into a grey "Other" band would hide the ones this business runs on.
Source identity is carried by axis labels and the source table instead. See the
header comment in `src/lib/chart-theme.ts`.

**The date range applies to every card, including the monthly ones.** One filter
row, no per-card filters. The consequence is that a 7-day range renders the MRR
trend as a single month. Use 90D/QTD/YTD when reading revenue.

## Conventions

- Currency MYR, shown as `RM 1,234`.
- Dates `DD/MM/YYYY` everywhere.
- Weeks start Monday.
- "Today" means today in `Asia/Kuala_Lumpur`, not on the server. Vercel runs UTC;
  without this, anything logged after 8am MYT would land on the wrong date.
- The `deals` table is the client register. The name is history; the UI says
  Client everywhere a human can see.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth)
· Recharts · deployed on Vercel.

Data fetching happens in server components. Client components are used only where
interaction requires them (the entry fields, the pipeline board, chart rendering,
table sorting, inline edits).
