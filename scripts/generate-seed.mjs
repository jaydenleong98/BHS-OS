/**
 * Generates supabase/seed.sql — ~90 days of plausible operating data for BHS OS.
 *
 * Two deliberate choices:
 *  1. Deterministic PRNG, so regenerating produces the identical file (no diff noise).
 *  2. Every date is emitted as `current_date - N`, so the dataset is always anchored
 *     to whenever you actually run it. Seed it in six months, still looks current.
 *
 * Run: npm run seed:gen
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- deterministic RNG -----------------------------------------------------

function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260810);

const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

/** Poisson draw (Knuth). Lead counts are counts of independent-ish events. */
function poisson(mean) {
  if (mean <= 0) return 0;
  const L = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}

/** Binomial draw. Bookings are conversions of leads, so they can never exceed them. */
function binomial(n, p) {
  let hits = 0;
  for (let i = 0; i < n; i++) if (rand() < p) hits++;
  return hits;
}

const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;
/** Every date is relative so the seed never goes stale. */
const dateExpr = (daysAgo) => (daysAgo === 0 ? "current_date" : `current_date - ${daysAgo}`);

// --- source characteristics ------------------------------------------------
// Each source behaves differently on purpose: cold is high-volume/low-intent,
// referral is tiny/high-intent, paid social sits in between and costs money.
// This is what makes the source performance table worth reading.

const SOURCES = [
  { key: "xhs",       leadsPerDay: 4.0, bookRate: 0.14, showRate: 0.72, spend: [0, 18],   closeWeight: 1.15 },
  { key: "cold",      leadsPerDay: 6.0, bookRate: 0.05, showRate: 0.62, spend: [4, 12],   closeWeight: 0.70 },
  { key: "facebook",  leadsPerDay: 3.0, bookRate: 0.11, showRate: 0.65, spend: [52, 96],  closeWeight: 0.85 },
  { key: "instagram", leadsPerDay: 2.2, bookRate: 0.12, showRate: 0.70, spend: [22, 48],  closeWeight: 0.95 },
  { key: "tiktok",    leadsPerDay: 3.5, bookRate: 0.07, showRate: 0.58, spend: [28, 62],  closeWeight: 0.60 },
  { key: "referral",  leadsPerDay: 0.5, bookRate: 0.55, showRate: 0.88, spend: [0, 0],    closeWeight: 2.40 },
  { key: "other",     leadsPerDay: 0.6, bookRate: 0.15, showRate: 0.70, spend: [0, 0],    closeWeight: 1.00 },
];

const DAYS = 90;

// Today is day 0. Day index d = "d days ago".
// Weekday factor: Malaysian SME audience goes quiet on weekends.
// We only know the weekday at SQL-run time, not generation time, so we model the
// weekly rhythm off the day offset instead — same shape, stable across runs.
function dayFactor(daysAgo) {
  const growth = 1 + ((DAYS - daysAgo) / DAYS) * 0.45; // slow ramp toward today
  const weeklyPhase = daysAgo % 7;
  const weekly = weeklyPhase === 2 || weeklyPhase === 3 ? 0.38 : 1.0; // the quiet pair
  const noise = 0.75 + rand() * 0.5;
  return growth * weekly * noise;
}

// --- daily_leads -----------------------------------------------------------

const leadRows = [];
let totalTaken = 0;
const takenBySource = Object.fromEntries(SOURCES.map((s) => [s.key, 0]));

for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
  const factor = dayFactor(daysAgo);
  for (const src of SOURCES) {
    const leads = poisson(src.leadsPerDay * factor);
    if (leads === 0 && rand() > 0.12) continue; // only rows with activity get saved

    const booked = binomial(leads, src.bookRate);
    const taken = binomial(booked, src.showRate);
    const [lo, hi] = src.spend;
    // Spend still happens on a zero-lead day — that's exactly the kind of waste
    // the cost-per-lead column is meant to expose.
    const spend = hi === 0 ? 0 : (lo + rand() * (hi - lo)) * Math.min(factor, 1.3);

    if (leads === 0 && spend === 0) continue;

    totalTaken += taken;
    takenBySource[src.key] += taken;
    leadRows.push(
      `  (${dateExpr(daysAgo)}, ${sql(src.key)}, ${leads}, ${booked}, ${taken}, ${spend.toFixed(2)})`
    );
  }
}

// --- deals -----------------------------------------------------------------

const CLIENTS = [
  "Aurora Dental Klang", "Suria Property Group", "KL Aesthetic Clinic",
  "Damansara Auto Detailing", "Penang Roofing Co", "Bumi Fitness Studio",
  "Zenith Legal Advisory", "Nusantara Travel", "Sri Muda Tuition Centre",
  "Bright Smile Orthodontics", "JB Solar Solutions", "Cyberjaya Coworking",
  "Setia Interior Design", "Mahsuri Catering", "Ipoh Coffee Roasters",
  "Bangsar Pet Clinic", "Puchong Aircond Services", "Melaka Heritage Homestay",
  "Shah Alam Logistics", "Kuantan Marine Supply", "Bandar Utama Physio",
  "Seremban Steel Works", "Mont Kiara Montessori", "Gombak Auto Parts",
  "Taiping Bakery House", "Subang Bridal Studio", "Kajang Satay Group",
  "Alor Setar Agritech",
];

const TIERS = {
  growth:       { setup: [3500, 5200],  monthly: [800, 1300] },
  professional: { setup: [6500, 9200],  monthly: [1500, 2600] },
  enterprise:   { setup: [12000, 18500], monthly: [3500, 5500] },
  custom:       { setup: [8000, 24000], monthly: [1000, 4200] },
};

// Deal volume ramps over ~10 months. Months 0-2 overlap the daily_leads window,
// which is what makes Taken -> Closed land in a believable 10-18% band.
const DEALS_PER_MONTH_BACK = [3, 5, 4, 4, 3, 3, 2, 2, 1, 1]; // index = months ago

const sourceKeys = SOURCES.map((s) => s.key);
const sourceCloseWeights = SOURCES.map((s) => s.closeWeight * s.leadsPerDay * s.bookRate);
const weightTotal = sourceCloseWeights.reduce((a, b) => a + b, 0);

function weightedSource() {
  let r = rand() * weightTotal;
  for (let i = 0; i < sourceKeys.length; i++) {
    r -= sourceCloseWeights[i];
    if (r <= 0) return sourceKeys[i];
  }
  return sourceKeys[sourceKeys.length - 1];
}

const deals = [];
let clientIdx = 0;

for (let monthsAgo = 0; monthsAgo < DEALS_PER_MONTH_BACK.length; monthsAgo++) {
  const count = DEALS_PER_MONTH_BACK[monthsAgo];
  for (let i = 0; i < count; i++) {
    if (clientIdx >= CLIENTS.length) break;
    const closeDaysAgo =
      monthsAgo === 0
        ? randInt(1, 27) // current month: spread across the days elapsed
        : monthsAgo * 30 + randInt(0, 29);

    const tier = pick(
      // enterprise stays rare; growth is the bread and butter
      ["growth", "growth", "growth", "professional", "professional", "enterprise", "custom"]
    );
    const t = TIERS[tier];
    const setup = Math.round((t.setup[0] + rand() * (t.setup[1] - t.setup[0])) / 100) * 100;
    const monthly = Math.round((t.monthly[0] + rand() * (t.monthly[1] - t.monthly[0])) / 50) * 50;

    deals.push({
      client: CLIENTS[clientIdx++],
      closeDaysAgo,
      source: weightedSource(),
      tier,
      setup,
      monthly,
      status: "active",
      churnDaysAgo: null,
      notes: null,
    });
  }
}

deals.sort((a, b) => b.closeDaysAgo - a.closeDaysAgo); // oldest first

// Churn: only older clients churn, and always after at least ~3 months of service.
const churnCandidates = deals.filter((d) => d.closeDaysAgo > 150);
const CHURN_NOTES = [
  "Founder sold the business; new owner brought automation in-house.",
  "Budget cut after a slow quarter. Left the door open for Q2.",
  "Outgrew the retainer and hired an internal ops person.",
  "Scope mismatch — wanted paid ads management, not CRM automation.",
];
for (let i = 0; i < 4 && i < churnCandidates.length; i++) {
  const d = churnCandidates[i * 2] ?? churnCandidates[i];
  if (!d || d.status === "churned") continue;
  d.status = "churned";
  d.churnDaysAgo = Math.max(3, d.closeDaysAgo - randInt(95, 150));
  d.notes = CHURN_NOTES[i];
}

// One paused client — pauses must not count toward MRR the way churn does,
// so having one in the seed keeps that distinction honest.
const pauseTarget = deals.find((d) => d.status === "active" && d.closeDaysAgo > 60 && d.closeDaysAgo < 140);
if (pauseTarget) {
  pauseTarget.status = "paused";
  pauseTarget.notes = "Paused for Ramadan period. Resuming next quarter.";
}

const dealRows = deals.map(
  (d) =>
    `  (${sql(d.client)}, ${dateExpr(d.closeDaysAgo)}, ${sql(d.source)}, ${sql(d.tier)}, ` +
    `${d.setup.toFixed(2)}, ${d.monthly.toFixed(2)}, ${sql(d.status)}, ` +
    `${d.churnDaysAgo === null ? "null" : dateExpr(d.churnDaysAgo)}, ` +
    `${d.notes ? sql(d.notes) : "null"})`
);

// --- projects --------------------------------------------------------------
// Projects reference deals by client_name via a lookup in the generated SQL,
// so we never have to hardcode uuids.

const PHASE_ONE = [
  "CRM Build & Pipeline Setup", "Lead Capture Automation", "GHL Workspace Buildout",
  "WhatsApp Booking Flow", "Sales Pipeline Migration", "Onboarding Automation",
];
const PHASE_TWO = [
  "Phase 2 — AI Voice Agent", "Phase 2 — Reactivation Campaign",
  "Phase 2 — Reporting Dashboard", "Phase 2 — Review Engine",
];

const projectRows = [];
let overdueBudget = 3; // deliberately leave a few past their target date, flagged red
let blockedBudget = 2;

for (const d of deals) {
  const projects = [{ name: pick(PHASE_ONE), isPhaseTwo: false }];
  if (d.closeDaysAgo > 120 && rand() < 0.45) {
    projects.push({ name: pick(PHASE_TWO), isPhaseTwo: true });
  }

  for (const p of projects) {
    const startDaysAgo = p.isPhaseTwo
      ? Math.max(2, d.closeDaysAgo - randInt(70, 110))
      : Math.max(1, d.closeDaysAgo - randInt(2, 6));
    const plannedDuration = randInt(21, 45);
    const targetDaysAgo = startDaysAgo - plannedDuration; // negative = target is in the future

    let status;
    let completedDaysAgo = null;

    if (targetDaysAgo > 14 && overdueBudget > 0 && rand() < 0.22) {
      // Past target, still not done. This is the row that should show up red.
      status = blockedBudget > 0 && rand() < 0.5 ? "blocked" : "in_progress";
      if (status === "blocked") blockedBudget--;
      overdueBudget--;
    } else if (targetDaysAgo > 0) {
      // Target has passed and it shipped — most projects land near target, some slip.
      const slip = randInt(-9, 12);
      completedDaysAgo = Math.max(0, targetDaysAgo - slip);
      if (completedDaysAgo > startDaysAgo) completedDaysAgo = startDaysAgo; // never finish before starting
      status = "completed";
    } else if (startDaysAgo > 0) {
      status = blockedBudget > 0 && rand() < 0.15 ? "blocked" : "in_progress";
      if (status === "blocked") blockedBudget--;
    } else {
      status = "not_started";
    }

    projectRows.push({
      client: d.client,
      name: p.name,
      startDaysAgo,
      targetDaysAgo,
      completedDaysAgo,
      status,
    });
  }
}

const projectValues = projectRows.map(
  (p) =>
    `  (${sql(p.client)}, ${sql(p.name)}, ${dateExpr(p.startDaysAgo)}, ` +
    `${dateExpr(p.targetDaysAgo)}, ` +
    `${p.completedDaysAgo === null ? "null" : dateExpr(p.completedDaysAgo)}, ${sql(p.status)})`
);

// --- daily_notes -----------------------------------------------------------

const NOTE_POOL = [
  "XHS post on clinic automation went semi-viral — 40+ DMs overnight.",
  "Meta ad account flagged for review, paused spend for the day.",
  "Public holiday. Almost nothing moved.",
  "Two no-shows in a row. Tightening the reminder sequence.",
  "Raised Growth tier setup fee from RM3.5k to RM4.5k starting today.",
  "Cold email domain hit spam folder — warming a second domain.",
  "Referral from Aurora Dental closed same week. Ask for more of these.",
  "TikTok leads are volume without intent. Considering cutting spend.",
  "Switched booking flow to WhatsApp — show rate looks better already.",
  "Ran a webinar; most of today's leads came from the replay page.",
  "Both of us were in delivery all day, zero outbound.",
  "New qualification question added to the form. Fewer leads, better calls.",
];

const noteRows = [];
const usedNoteDays = new Set();
for (let i = 0; i < NOTE_POOL.length; i++) {
  let daysAgo;
  do {
    daysAgo = randInt(0, DAYS - 1);
  } while (usedNoteDays.has(daysAgo));
  usedNoteDays.add(daysAgo);
  noteRows.push(`  (${dateExpr(daysAgo)}, ${sql(NOTE_POOL[i])})`);
}

// --- emit ------------------------------------------------------------------

const out = `-- BHS OS — seed data (GENERATED by scripts/generate-seed.mjs — do not edit by hand)
--
-- ${DAYS} days of daily_leads, ${deals.length} deals across ~10 months, ${projectRows.length} projects, ${noteRows.length} day notes.
-- Every date is relative to current_date, so this stays plausible whenever you run it.
-- Safe to re-run: it clears the three tables first.
--
-- Run in the Supabase SQL editor AFTER schema.sql.

begin;

delete from projects;
delete from deals;
delete from daily_leads;
delete from daily_notes;

-- ---------------------------------------------------------------------------
-- daily_leads (flow) — ${leadRows.length} rows
-- ---------------------------------------------------------------------------
insert into daily_leads (entry_date, source, leads_generated, calls_booked, calls_taken, spend_myr) values
${leadRows.join(",\n")};

-- ---------------------------------------------------------------------------
-- deals (conversion + state) — ${deals.length} rows
-- ---------------------------------------------------------------------------
insert into deals (client_name, close_date, source, tier, setup_fee_myr, monthly_fee_myr, status, churn_date, notes) values
${dealRows.join(",\n")};

-- ---------------------------------------------------------------------------
-- projects (fulfilment state) — ${projectRows.length} rows
-- deal_id resolved by client_name so no uuids are hardcoded.
-- ---------------------------------------------------------------------------
insert into projects (deal_id, project_name, start_date, target_date, completed_date, status)
select d.id, v.project_name, v.start_date, v.target_date, v.completed_date, v.status
from (values
${projectValues.join(",\n")}
) as v(client_name, project_name, start_date, target_date, completed_date, status)
join deals d on d.client_name = v.client_name;

-- ---------------------------------------------------------------------------
-- daily_notes (context) — ${noteRows.length} rows
-- ---------------------------------------------------------------------------
insert into daily_notes (entry_date, note) values
${noteRows.join(",\n")};

commit;
`;

mkdirSync(join(ROOT, "supabase"), { recursive: true });
writeFileSync(join(ROOT, "supabase", "seed.sql"), out, "utf8");

// Sanity summary so the generated funnel is sane before it ever reaches a chart.
const totals = leadRows.reduce(
  (acc, row) => {
    const nums = row.match(/, (\d+), (\d+), (\d+), ([\d.]+)\)$/);
    if (nums) {
      acc.leads += +nums[1];
      acc.booked += +nums[2];
      acc.taken += +nums[3];
      acc.spend += +nums[4];
    }
    return acc;
  },
  { leads: 0, booked: 0, taken: 0, spend: 0 }
);
const dealsInWindow = deals.filter((d) => d.closeDaysAgo < DAYS).length;
const pct = (n, d) => (d === 0 ? "—" : ((n / d) * 100).toFixed(1) + "%");

console.log(`Wrote supabase/seed.sql (${leadRows.length} daily_leads rows)`);
console.log(`  ${DAYS}d funnel: ${totals.leads} leads -> ${totals.booked} booked -> ${totals.taken} taken -> ${dealsInWindow} closed`);
console.log(`  lead->booked ${pct(totals.booked, totals.leads)} | show ${pct(totals.taken, totals.booked)} | close ${pct(dealsInWindow, totals.taken)}`);
console.log(`  spend RM${totals.spend.toFixed(0)} | CPL RM${(totals.spend / totals.leads).toFixed(2)} | CPA RM${(totals.spend / dealsInWindow).toFixed(2)}`);
console.log(`  ${deals.length} deals, ${deals.filter((d) => d.status === "active").length} active, ${deals.filter((d) => d.status === "churned").length} churned, ${deals.filter((d) => d.status === "paused").length} paused`);
console.log(`  ${projectRows.length} projects, ${projectRows.filter((p) => p.status === "completed").length} completed, ${projectRows.filter((p) => p.status === "blocked").length} blocked`);
