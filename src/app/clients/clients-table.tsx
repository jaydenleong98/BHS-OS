"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { diffDays, formatDMY } from "@/lib/dates";
import { formatMYR } from "@/lib/format";
import {
  DEAL_STATUSES,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  SOURCE_LABELS,
  TIER_LABELS,
  type Deal,
  type DealStatus,
  type Project,
  type ProjectStatus,
} from "@/lib/types";
import { Badge, cx, EmptyState } from "@/components/ui";
import {
  addProject,
  setDealStatus,
  setProjectStatus,
  setProjectTargetDate,
  updateDealFees,
} from "./actions";

type Filter = "all" | DealStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "churned", label: "Churned" },
];

export function ClientsTable({
  deals,
  projects,
  todayISO,
}: {
  deals: Deal[];
  projects: Project[];
  todayISO: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const projectsByDeal = useMemo(() => {
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
    return deals.filter((deal) => {
      if (filter !== "all" && deal.status !== filter) return false;
      if (needle && !deal.client_name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [deals, filter, query]);

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: deals.length, active: 0, paused: 0, churned: 0 };
    for (const deal of deals) base[deal.status] += 1;
    return base;
  }, [deals]);

  /** Every mutation goes through here so failures surface instead of silently no-op'ing. */
  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

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
                filter === f.key
                  ? "bg-accent/15 text-accent-bright"
                  : "text-ink-muted hover:text-ink"
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
          {visible.length} of {deals.length} shown
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
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[1.6fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_0.7fr] gap-2 border-b border-line px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              <div>Client</div>
              <div>Source</div>
              <div>Tier</div>
              <div>Closed</div>
              <div className="text-right">Setup</div>
              <div className="text-right">Monthly</div>
              <div>Status</div>
              <div className="text-right">Projects</div>
            </div>

            <div className="divide-y divide-line">
              {visible.map((deal) => {
                const dealProjects = projectsByDeal.get(deal.id) ?? [];
                const open = expanded.has(deal.id);
                const overdueCount = dealProjects.filter(
                  (p) =>
                    p.status !== "completed" &&
                    p.completed_date === null &&
                    p.target_date !== null &&
                    p.target_date < todayISO
                ).length;

                return (
                  <div key={deal.id}>
                    <div className="grid grid-cols-[1.6fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_0.7fr] items-center gap-2 px-3 py-2 hover:bg-surface-2/50">
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggle(deal.id)}
                          aria-expanded={open}
                          aria-label={open ? "Collapse projects" : "Expand projects"}
                          className="shrink-0 rounded px-1 text-xs text-ink-faint transition-colors hover:text-ink"
                        >
                          {open ? "▾" : "▸"}
                        </button>
                        <span className="truncate text-sm text-ink" title={deal.client_name}>
                          {deal.client_name}
                        </span>
                        {deal.status === "churned" && deal.churn_date ? (
                          <span className="tabular shrink-0 text-[11px] text-bad">
                            ↓ {formatDMY(deal.churn_date)}
                          </span>
                        ) : null}
                      </div>

                      <div className="text-xs text-ink-muted">{SOURCE_LABELS[deal.source]}</div>
                      <div className="text-xs text-ink-muted">
                        {deal.tier ? TIER_LABELS[deal.tier] : "—"}
                      </div>
                      <div className="tabular text-xs text-ink-muted">
                        {formatDMY(deal.close_date)}
                      </div>

                      <FeeCell
                        value={deal.setup_fee_myr}
                        onCommit={(next) =>
                          run(() =>
                            updateDealFees({
                              id: deal.id,
                              setup_fee_myr: next,
                              monthly_fee_myr: deal.monthly_fee_myr,
                            })
                          )
                        }
                      />
                      <FeeCell
                        value={deal.monthly_fee_myr}
                        onCommit={(next) =>
                          run(() =>
                            updateDealFees({
                              id: deal.id,
                              setup_fee_myr: deal.setup_fee_myr,
                              monthly_fee_myr: next,
                            })
                          )
                        }
                      />

                      <div>
                        <select
                          value={deal.status}
                          onChange={(e) =>
                            run(() =>
                              setDealStatus({
                                id: deal.id,
                                status: e.target.value as DealStatus,
                              })
                            )
                          }
                          aria-label={`Status for ${deal.client_name}`}
                          className={cx(
                            "w-full rounded border bg-surface-2 px-1.5 py-1 text-xs outline-none transition-colors focus:border-accent",
                            deal.status === "active" && "border-good/30 text-good",
                            deal.status === "paused" && "border-warn/30 text-warn",
                            deal.status === "churned" && "border-bad/30 text-bad"
                          )}
                        >
                          {DEAL_STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-surface text-ink">
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-end gap-1.5">
                        {overdueCount > 0 ? <Badge tone="bad">{overdueCount} late</Badge> : null}
                        <button
                          type="button"
                          onClick={() => toggle(deal.id)}
                          className="tabular rounded border border-line px-1.5 py-0.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                        >
                          {dealProjects.length}
                        </button>
                      </div>
                    </div>

                    {open ? (
                      <ProjectPanel
                        deal={deal}
                        projects={dealProjects}
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
        Setting a client to <span className="text-bad">churned</span> stamps today as the churn
        date and removes them from MRR. Marking a project{" "}
        <span className="text-good">completed</span> stamps today as the completion date and feeds
        average delivery time.
      </p>
    </div>
  );
}

/** Click-to-edit money cell. Commits on blur or Enter, reverts on Escape. */
function FeeCell({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (next: number) => void;
}) {
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

function ProjectPanel({
  deal,
  projects,
  todayISO,
  run,
}: {
  deal: Deal;
  projects: Project[];
  todayISO: string;
  run: (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState(todayISO);
  const [target, setTarget] = useState("");

  return (
    <div className="border-t border-line bg-surface-2/40 px-3 py-3 pl-9">
      {projects.length === 0 ? (
        <p className="text-xs text-ink-faint">
          No projects yet. Fulfilment metrics for {deal.client_name} stay empty until one exists.
        </p>
      ) : (
        <div className="space-y-1.5">
          {projects.map((project) => {
            const overdue =
              project.status !== "completed" &&
              project.completed_date === null &&
              project.target_date !== null &&
              project.target_date < todayISO;
            const lateBy = overdue && project.target_date ? diffDays(project.target_date, todayISO) : null;

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
                deal_id: deal.id,
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
            Project name
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CRM Build & Pipeline Setup"
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
          + Add project
        </button>
      )}
    </div>
  );
}
