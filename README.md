# BHS OS

A personal sales-activity hub for Jayden. One user, no roles, no CRM.

It exists to answer one question — **am I doing the sales work daily, and is
it trending up or down** — and nothing else.

Three pages: log the day on `/entry`, keep scripts and objection responses on
`/scripts`, read the trend on `/dashboard`.

## The four numbers

**Outreach** — new, cold contact with a named prospect.
**Follow-up** — a touch on a prospect already in conversation.
**Meetings booked** — a call or meeting confirmed on the calendar today.
**Meetings attended** — a call or meeting that actually happened today.

That is the entire daily typing surface. Blank counts as zero, and saving an
all-zero day still counts as a logged day — "I did nothing today" is a
complete answer, and the streak has to be able to tell it apart from a day
that was never logged at all.

## Setup

1. Create a Supabase project.
2. SQL Editor → run `supabase/schema.sql` (tables, indexes, RLS). It is
   idempotent, and drops every table from the old client-ops version of this
   app (pipeline, clients, revenue, settings) if they exist.
3. Authentication → Users → add your account by email/password. Leave signups
   disabled.
4. Copy `.env.local.example` to `.env.local` and fill in the project URL and
   anon key (Project Settings → API).
5. `npm install && npm run dev`

### Preview mode (no Supabase)

To look at the UI before there's a project to point at, put this in `.env.local`
instead of the two Supabase keys and run `npm run dev`:

```
NEXT_PUBLIC_PREVIEW_DATA=1
```

Auth is bypassed and every query is served from `src/lib/preview/` — an in-memory
table set that starts **empty**. Whatever you type in during the session is all
it will show, and it is gone on restart. Never set this flag on a deployment.

## The pages

**`/entry`** — four number fields, one optional note, one save button. Under
60 seconds. No totals, no rates, no summary at the top: entry and review are
different jobs.

**`/scripts`** — the sales script and objection-handling library. Two
sections, same card shape: a title, a body, save and delete. It's a personal
reference, not a shared or versioned document — the bar is "fast to open and
fast to edit" during or right before a call.

**`/dashboard`** — activity totals for the selected range (with the change vs
the previous period of the same length), the logging streak, and a trend chart
across all four numbers. Daily points for a range of a month or less, weekly
buckets beyond that so the chart doesn't drown in points.

## Conventions

- Dates `DD/MM/YYYY` everywhere. Weeks start Monday.
- "Today" means today in `Asia/Kuala_Lumpur`, not on the server. Vercel runs
  UTC; without this, anything logged after 8am MYT would land on the wrong date.
- Every metric definition lives in `src/lib/metrics.ts`. `safeDiv` is the only
  division used to compute a metric; anything with a denominator returns
  `number | null`, and `null` renders as `—`, never a misleading zero.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth)
· Recharts · deployed on Vercel.

Data fetching happens in server components. Client components are used only
where interaction requires them (the entry fields, the scripts editor, chart
rendering).
