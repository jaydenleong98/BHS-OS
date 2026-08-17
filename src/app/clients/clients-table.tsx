"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { diffDays, formatDMY } from "@/lib/dates";
import { formatMYR, formatPct } from "@/lib/format";
import { onboardingCompletion } from "@/lib/metrics";
import {
  CLIENT_STATUSES,
  ONBOARDING_STEPS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  SOURCE_LABELS,
  STALE_CONTACT_DAYS,
  type Client,
  type ClientStatus,
  type OnboardingProgress,
  type Project,
  type ProjectStatus,
} from "@/lib/types";
import { Badge, cx, EmptyState } from "@/components/ui";
import {
  addProject,
  markReferralAsked,
  setBillingConfirmed,
  setClientStatus,
  setDeliveryPain,
  setGoLiveDate,
  setLastContact,
  setOnboardingStep,
  setProjectStatus,
  setProjectTargetDate,
  updateClientFees,
} from "./actions";

type Result = { ok: true } | { ok: false; error: string };
type Run = (action: () => Promise<Result>) => void;

type Filter = "all" | ClientStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "churned", label: "Churned" },
];

const GRID = "grid-cols-[1.6fr_0.7fr_0.8fr_0.8fr_0.8fr_0.9fr_1.3fr_0.7fr]";

export function ClientsTable({
  clients,
  projects,
  onboarding,
  todayISO,
}: {
  clients: Client[];
  projects: Project[];
  onboarding: OnboardingProgress[];
  todayISO: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const projectsByClient = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const project of projects) {
      if (!project.deal_id) continue;
      const list = map.get(project.deal_id) ?? [];
      list.push(project);
      map.set(project.deal_id, list);
    }
    return map;
  }, [projects]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (filter !== "all" && client.status !== filter) return false;
      if (needle && !client.client_name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [clients, filter, query]);

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: clients.length, active: 0, paused: 0, churned: 0 };
    for (const client of clients) base[client.status] += 1;
    return base;
  }, [clients]);

  /** Every mutation goes through here so failures surface instead of silently no-op'ing. */
  const run: Run = (action) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  };

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={cx("space-y-3", pending && "opacity-70 transition-opacity")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-line bg-surface p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cx(
                "rounded px-2.5 py-1.5 text-xs transition-colors",
                filter === f.key ? "bg-accent/15 text-accent-bright" : "text-ink-muted hover:text-ink"
              )}
            >
              {f.label} <span className="tabular text-ink-faint">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search client…"
          className="w-48 rounded-md border border-line bg-surface px-3 py-1.5 text-xs outline-none transition-colors placeholder:text-ink-faint/60 focus:border-accent"
        />

        <span className="ml-auto text-xs text-ink-faint">
          {visible.length} of {clients.length} shown
        </span>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          compact
          title="No clients match this filter."
          hint="Clear the search or switch back to All."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <div className="min-w-[1000px]">
            <div
              className={cx(
                "grid gap-2 border-b border-line px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint",
                GRID
              )}
            >
              <div>Client</div>
              <div>Source</div>
              <div>Won</div>
              <div className="text-right">Setup</div>
              <div className="text-right">Monthly</div>
              <div>Status</div>
              <div>Flags</div>
              <div className="text-right">Projects</div>
            </div>

            <div className="divide-y divide-line">
              {visible.map((client) => {
                const clientProjects = projectsByClient.get(client.id) ?? [];
                const open = expanded.has(client.id);
                const overdueCount = clientProjects.filter(
                  (p) =>
                    p.status !== "completed" &&
                    p.completed_date === null &&
                    p.target_date !== null &&
                    p.target_date < todayISO
                ).length;

                const daysSinceContact =
                  client.last_contact_on === null
                    ? null
                    : diffDays(client.last_contact_on, todayISO);
                const stale =
                  client.status !== "churned" &&
                  (daysSinceContact === null || daysSinceContact > STALE_CONTACT_DAYS);
                const completion = onboardingCompletion(onboarding, client.id);

                return (
                  <div key={client.id}>
                    <div className={cx("grid items-center gap-2 px-3 py-2 hover:bg-surface-2/50", GRID)}>
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggle(client.id)}
                          aria-expanded={open}
                          aria-label={open ? "Collapse client" : "Expand client"}
                          className="shrink-0 rounded px-1 text-xs text-ink-faint transition-colors hover:text-ink"
                        >
                          {open ? "▾" : "▸"}
                        </button>
                        <span className="truncate text-sm text-ink" title={client.client_name}>
                          {client.client_name}
                        </span>
                        {client.status === "churned" && client.churn_date ? (
                          <span className="tabular shrink-0 text-[11px] text-bad">
                            ↓ {formatDMY(client.churn_date)}
                          </span>
                        ) : null}
                      </div>

                      <div className="text-xs text-ink-muted">{SOURCE_LABELS[client.source]}</div>
                      <div className="tabular text-xs text-ink-muted">
                        {formatDMY(client.close_date)}
                      </div>

                      <FeeCell
                        value={client.setup_fee_myr}
                        onCommit={(next) =>
                          run(() =>
                            updateClientFees({
                              id: client.id,
                              setup_fee_myr: next,
                              monthly_fee_myr: client.monthly_fee_myr,
                            })
                          )
                        }
                      />
                      <FeeCell
                        value={client.monthly_fee_myr}
                        onCommit={(next) =>
                          run(() =>
                            updateClientFees({
                              id: client.id,
                              setup_fee_myr: client.setup_fee_myr,
                              monthly_fee_myr: next,
                            })
                          )
                        }
                      />

                      <div>
                        <select
                          value={client.status}
                          onChange={(e) =>
                            run(() =>
                              setClientStatus({
                                id: client.id,
                                status: e.target.value as ClientStatus,
                              })
                            )
                          }
                          aria-label={`Status for ${client.client_name}`}
                          className={cx(
                            "w-full rounded border bg-surface-2 px-1.5 py-1 text-xs outline-none transition-colors focus:border-accent",
                            client.status === "active" && "border-good/30 text-good",
                            client.status === "paused" && "border-warn/30 text-warn",
                            client.status === "churned" && "border-bad/30 text-bad"
                          )}
                        >
                          {CLIENT_STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-surface text-ink">
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {stale ? (
                          <Badge tone="warn">
                            ⚠ {daysSinceContact === null ? "never contacted" : `${daysSinceContact}d quiet`}
                          </Badge>
                        ) : null}
                        {client.status !== "churned" && !client.billing_terms_confirmed ? (
                          <Badge tone="bad">⚠ billing unconfirmed</Badge>
                        ) : null}
                        {client.delivery_pain !== null && client.delivery_pain >= 4 ? (
                          <Badge tone="bad">pain {client.delivery_pain}</Badge>
                        ) : null}
                        {completion < 1 && client.status === "active" ? (
                          <Badge>{formatPct(completion, 0)} onboarded</Badge>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-end gap-1.5">
                        {overdueCount > 0 ? <Badge tone="bad">{overdueCount} late</Badge> : null}
                        <button
                          type="button"
                          onClick={() => toggle(client.id)}
                          className="tabular rounded border border-line px-1.5 py-0.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                        >
                          {clientProjects.length}
                        </button>
                      </div>
                    </div>

                    {open ? (
                      <ClientPanel
                        client={client}
                        projects={clientProjects}
                        onboarding={onboarding}
                        todayISO={todayISO}
                        run={run}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-ink-faint">
        Setting a client to <span className="text-bad">churned</span> stamps today as the churn date
        and removes them from MRR. Marking a project{" "}
        <span className="text-good">completed</span> stamps today as the completion date and feeds
        average delivery time.
      </p>
    </div>
  );
}

/** Click-to-edit money cell. Commits on blur or Enter, reverts on Escape. */
function FeeCell({ value, onCommit }: { value: number; onCommit: (next: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        className="tabular rounded px-1 py-0.5 text-right text-xs text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
      >
        {formatMYR(value)}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    const next = Number(draft);
    if (Number.isFinite(next) && next >= 0 && next !== value) onCommit(next);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="tabular w-full rounded border border-accent bg-surface-3 px-1.5 py-0.5 text-right text-xs outline-none"
    />
  );
}

// ---------------------------------------------------------------------------
// Expanded panel
// ---------------------------------------------------------------------------

function ClientPanel({
  client,
  projects,
  onboarding,
  todayISO,
  run,
}: {
  client: Client;
  projects: Project[];
  onboarding: OnboardingProgress[];
  todayISO: string;
  run: Run;
}) {
  const done = new Set(
    onboarding.filter((p) => p.client_id === client.id).map((p) => p.step_key)
  );
  const completion = done.size / ONBOARDING_STEPS.length;

  return (
    <div className="border-t border-line bg-surface-2/40 px-3 py-3 pl-9">
      <div className="grid gap-4 lg:grid-cols-2">
        <Relationship client={client} todayISO={todayISO} run={run} />

        <section>
          <h4 className="mb-2 flex items-baseline gap-2 text-xs font-medium text-ink-muted">
            Onboarding
            <span className="tabular text-[11px] text-ink-faint">
              {done.size}/{ONBOARDING_STEPS.length} · {formatPct(completion, 0)}
            </span>
          </h4>

          <ul className="space-y-1">
            {ONBOARDING_STEPS.map((step) => {
              const checked = done.has(step.key);
              return (
                <li key={step.key}>
                  <label className="flex cursor-pointer items-center gap-2 rounded border border-line bg-surface px-2 py-1.5 text-xs transition-colors hover:border-line-strong">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        run(() =>
                          setOnboardingStep({
                            client_id: client.id,
                            step_key: step.key,
                            done: e.target.checked,
                          })
                        )
                      }
                      className="accent-[color:var(--color-accent)]"
                    />
                    <span className={checked ? "text-ink-muted line-through" : "text-ink"}>
                      {step.label}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <ProjectPanel client={client} projects={projects} todayISO={todayISO} run={run} />
    </div>
  );
}

function Relationship({
  client,
  todayISO,
  run,
}: {
  client: Client;
  todayISO: string;
  run: Run;
}) {
  const daysSinceContact =
    client.last_contact_on === null ? null : diffDays(client.last_contact_on, todayISO);
  const stale = daysSinceContact === null || daysSinceContact > STALE_CONTACT_DAYS;

  const fieldClass =
    "tabular w-full rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent";

  return (
    <section className="space-y-3">
      <h4 className="text-xs font-medium text-ink-muted">Relationship</h4>

      <div>
        <div className="mb-1 flex items-baseline gap-2 text-[11px] text-ink-faint">
          Delivery pain
          {client.delivery_pain_updated_on ? (
            <span className="tabular">set {formatDMY(client.delivery_pain_updated_on)}</span>
          ) : (
            <span>never rated</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((level) => {
            const active = client.delivery_pain === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() =>
                  run(() => setDeliveryPain({ id: client.id, pain: active ? null : level }))
                }
                aria-pressed={active}
                title={`${level} — ${level <= 2 ? "easy" : level === 3 ? "normal" : "heavy"}`}
                className={cx(
                  "tabular h-7 w-7 rounded border text-xs transition-colors",
                  active
                    ? level >= 4
                      ? "border-bad/50 bg-bad/15 text-bad"
                      : "border-accent/50 bg-accent/15 text-accent-bright"
                    : "border-line bg-surface text-ink-faint hover:border-line-strong hover:text-ink"
                )}
              >
                {level}
              </button>
            );
          })}
          <span className="ml-1 text-[11px] text-ink-faint">1 easy · 5 heavy</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-ink-faint">
          <span className={cx(stale && "text-warn")}>
            Last contact
            {daysSinceContact !== null ? ` · ${daysSinceContact}d` : " · never"}
          </span>
          <div className="mt-0.5 flex items-center gap-1">
            <input
              type="date"
              value={client.last_contact_on ?? ""}
              max={todayISO}
              onChange={(e) =>
                run(() => setLastContact({ id: client.id, date: e.target.value || null }))
              }
              className={cx(fieldClass, stale && "border-warn/40")}
            />
            <button
              type="button"
              onClick={() => run(() => setLastContact({ id: client.id, date: todayISO }))}
              className="shrink-0 rounded border border-line px-1.5 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent/40 hover:text-accent-bright"
            >
              Today
            </button>
          </div>
        </label>

        <label className="block text-[11px] text-ink-faint">
          Go-live date
          <input
            type="date"
            value={client.go_live_date ?? ""}
            onChange={(e) =>
              run(() => setGoLiveDate({ id: client.id, date: e.target.value || null }))
            }
            className={cx(fieldClass, "mt-0.5")}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-ink-faint">
          Referral asked{" "}
          {client.referral_asked_on ? (
            <span className="tabular text-ink-muted">{formatDMY(client.referral_asked_on)}</span>
          ) : (
            <span className="text-warn">never</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => run(() => markReferralAsked({ id: client.id }))}
          className="rounded border border-line px-2 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent/40 hover:text-accent-bright"
        >
          Asked today
        </button>
      </div>

      <label
        className={cx(
          "flex cursor-pointer items-start gap-2 rounded border px-2 py-1.5 text-xs transition-colors",
          client.billing_terms_confirmed
            ? "border-good/30 bg-good/5"
            : "border-bad/40 bg-bad/5"
        )}
      >
        <input
          type="checkbox"
          checked={client.billing_terms_confirmed}
          onChange={(e) =>
            run(() => setBillingConfirmed({ id: client.id, confirmed: e.target.checked }))
          }
          className="mt-0.5 accent-[color:var(--color-good)]"
        />
        <span>
          <span className={client.billing_terms_confirmed ? "text-good" : "text-bad"}>
            Billing terms confirmed verbally
          </span>
          <span className="mt-0.5 block text-[11px] text-ink-faint">
            Setup fee and monthly retainer both said out loud at onboarding, and repeated back.
            {client.billing_terms_confirmed_on
              ? ` Confirmed ${formatDMY(client.billing_terms_confirmed_on)}.`
              : ""}
          </span>
        </span>
      </label>
    </section>
  );
}

function ProjectPanel({
  client,
  projects,
  todayISO,
  run,
}: {
  client: Client;
  projects: Project[];
  todayISO: string;
  run: Run;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState(todayISO);
  const [target, setTarget] = useState("");

  return (
    <div className="mt-4 border-t border-line pt-3">
      <h4 className="mb-2 text-xs font-medium text-ink-muted">Builds</h4>

      {projects.length === 0 ? (
        <p className="text-xs text-ink-faint">
          No builds yet. Fulfilment metrics for {client.client_name} stay empty until one exists.
        </p>
      ) : (
        <div className="space-y-1.5">
          {projects.map((project) => {
            const overdue =
              project.status !== "completed" &&
              project.completed_date === null &&
              project.target_date !== null &&
              project.target_date < todayISO;
            const lateBy =
              overdue && project.target_date ? diffDays(project.target_date, todayISO) : null;

            return (
              <div
                key={project.id}
                className={cx(
                  "grid grid-cols-[1.6fr_0.9fr_0.9fr_0.9fr_1fr_auto] items-center gap-2 rounded border px-2.5 py-1.5",
                  overdue ? "border-bad/40 bg-bad/5" : "border-line bg-surface"
                )}
              >
                <span className="truncate text-xs text-ink" title={project.project_name}>
                  {project.project_name}
                </span>

                <span className="tabular text-[11px] text-ink-faint">
                  Start {formatDMY(project.start_date)}
                </span>

                <label className="flex items-center gap-1 text-[11px] text-ink-faint">
                  <span className="shrink-0">Target</span>
                  <input
                    type="date"
                    value={project.target_date ?? ""}
                    onChange={(e) =>
                      run(() =>
                        setProjectTargetDate({
                          id: project.id,
                          target_date: e.target.value || null,
                        })
                      )
                    }
                    aria-label={`Target date for ${project.project_name}`}
                    className={cx(
                      "tabular w-full rounded border bg-surface-2 px-1 py-0.5 text-[11px] outline-none focus:border-accent",
                      overdue ? "border-bad/40 text-bad" : "border-line text-ink-muted"
                    )}
                  />
                </label>

                <span className="tabular text-[11px] text-ink-faint">
                  {project.completed_date ? `Done ${formatDMY(project.completed_date)}` : ""}
                  {overdue && lateBy !== null ? (
                    <span className="text-bad">{lateBy}d late</span>
                  ) : null}
                </span>

                <select
                  value={project.status}
                  onChange={(e) =>
                    run(() =>
                      setProjectStatus({
                        id: project.id,
                        status: e.target.value as ProjectStatus,
                      })
                    )
                  }
                  aria-label={`Status for ${project.project_name}`}
                  className="w-full rounded border border-line bg-surface-2 px-1.5 py-1 text-[11px] text-ink-muted outline-none transition-colors focus:border-accent"
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-surface text-ink">
                      {PROJECT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>

                <div className="flex justify-end">
                  {project.status === "completed" ? (
                    <Badge tone="good">✓</Badge>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        run(() => setProjectStatus({ id: project.id, status: "completed" }))
                      }
                      className="whitespace-nowrap rounded border border-good/30 bg-good/10 px-2 py-1 text-[11px] text-good transition-colors hover:bg-good/20"
                    >
                      Mark done
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const result = await addProject({
                deal_id: client.id,
                project_name: name,
                start_date: start,
                target_date: target || null,
              });
              if (result.ok) {
                setName("");
                setTarget("");
                setAdding(false);
              }
              return result;
            });
          }}
          className="mt-2 flex flex-wrap items-end gap-2 rounded border border-line bg-surface px-2.5 py-2"
        >
          <label className="flex-1 text-[11px] text-ink-faint">
            Build name
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Phase 2 — AI voice agent"
              className="mt-0.5 w-full rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="text-[11px] text-ink-faint">
            Start
            <input
              type="date"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="tabular mt-0.5 block rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="text-[11px] text-ink-faint">
            Target
            <input
              type="date"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="tabular mt-0.5 block rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-bright"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded border border-line px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 rounded border border-line px-2.5 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent/40 hover:text-accent-bright"
        >
          + Add build
        </button>
      )}
    </div>
  );
}
