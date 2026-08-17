"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { diffDays, formatDMY } from "@/lib/dates";
import { formatMYR } from "@/lib/format";
import { stageDate, type PipelineValue } from "@/lib/metrics";
import {
  OPEN_STAGES,
  SOURCES,
  SOURCE_LABELS,
  STAGE_LABELS,
  STAGE_SHORT,
  nextStage,
  type Client,
  type OpenStage,
  type Prospect,
  type Source,
  type Stage,
} from "@/lib/types";
import { Badge, Card, cx, EmptyState } from "@/components/ui";
import {
  createProspect,
  deleteProspect,
  loseProspect,
  moveProspect,
  updateProspect,
  winProspect,
} from "./actions";

type Result = { ok: true } | { ok: false; error: string };

/**
 * The pipeline. Source lives on these cards, which is why the entry page no
 * longer asks for it, and every funnel count on the dashboard is a count of
 * these records reaching a stage.
 *
 * Moving a card is one click: the button on the card face advances it. The forms
 * are reserved for the two transitions that genuinely need typing — won (actual
 * fees) and lost (a reason).
 */
export function PipelineBoard({
  prospects,
  clients,
  pipelineValue,
  todayISO,
}: {
  prospects: Prospect[];
  clients: Client[];
  pipelineValue: PipelineValue;
  todayISO: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [winning, setWinning] = useState<Prospect | null>(null);
  const [losing, setLosing] = useState<Prospect | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  /**
   * Drag state.
   *
   * Native HTML5 drag and drop, no library. It is a convenience layer only —
   * the buttons on every card do the same job and stay the accessible path, so
   * this works fine with a keyboard and on a phone, where dragging does not.
   */
  const [dragging, setDragging] = useState<Prospect | null>(null);
  const [dropStage, setDropStage] = useState<OpenStage | null>(null);

  function run(action: () => Promise<Result>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else {
        onDone?.();
        router.refresh();
      }
    });
  }

  const byStage = useMemo(() => {
    const map = new Map<OpenStage, Prospect[]>(OPEN_STAGES.map((s) => [s, []]));
    for (const p of prospects) {
      const list = map.get(p.stage as OpenStage);
      if (list) list.push(p);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (stageDate(b, b.stage) ?? "").localeCompare(stageDate(a, a.stage) ?? ""));
    }
    return map;
  }, [prospects]);

  const won = prospects.filter((p) => p.stage === "won").sort((a, b) => (b.won_on ?? "").localeCompare(a.won_on ?? ""));
  const lost = prospects.filter((p) => p.stage === "lost").sort((a, b) => (b.lost_on ?? "").localeCompare(a.lost_on ?? ""));

  return (
    <div className={cx("space-y-4", pending && "opacity-70 transition-opacity")}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setAdding((open) => !open)}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-bright"
        >
          + Add prospect
        </button>

        <span className="text-xs text-ink-muted">
          <span className="tabular font-semibold text-ink">{pipelineValue.openCount}</span> open
        </span>
        <span className="text-xs text-ink-muted">
          Weighted{" "}
          <span className="tabular font-semibold text-ink">
            {formatMYR(pipelineValue.weightedMonthly)}
          </span>
          /mo
          <span className="ml-1 text-ink-faint">+ {formatMYR(pipelineValue.weightedSetup)} setup</span>
        </span>
      </div>

      {adding ? (
        <ProspectForm
          clients={clients}
          todayISO={todayISO}
          onCancel={() => setAdding(false)}
          onSubmit={(values) =>
            run(() => createProspect(values), () => setAdding(false))
          }
        />
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </p>
      ) : null}

      {prospects.length === 0 ? (
        <EmptyState
          title="No prospects yet."
          hint="Add the first one. Every funnel number on the dashboard is a count of these records reaching a stage — nothing is typed in as a total."
        />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="grid min-w-[900px] grid-cols-5 gap-2">
            {OPEN_STAGES.map((stage) => {
              const cards = byStage.get(stage) ?? [];
              // Its own column is not a drop target — nothing would change.
              const isTarget = dropStage === stage && dragging !== null && dragging.stage !== stage;

              return (
                <section
                  key={stage}
                  onDragOver={(e) => {
                    if (!dragging || dragging.stage === stage) return;
                    // preventDefault is what marks this as a valid drop target.
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropStage(stage);
                  }}
                  onDragLeave={(e) => {
                    // Ignore the events fired while crossing a child element.
                    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                    setDropStage((current) => (current === stage ? null : current));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = dragging;
                    setDropStage(null);
                    setDragging(null);
                    if (!dropped || dropped.stage === stage) return;
                    run(() => moveProspect({ id: dropped.id, stage }));
                  }}
                  className={cx(
                    "flex flex-col rounded-lg border bg-surface transition-colors",
                    isTarget ? "border-accent-bright bg-accent/5" : "border-line"
                  )}
                >
                  <header className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-2">
                    <h2 className="text-xs font-semibold tracking-tight text-ink">
                      {STAGE_SHORT[stage]}
                    </h2>
                    <span className="tabular text-xs text-ink-faint">{cards.length}</span>
                  </header>

                  <div className="flex flex-1 flex-col gap-2 p-2">
                    {cards.length === 0 ? (
                      <p
                        className={cx(
                          "px-1 py-4 text-center text-[11px] transition-colors",
                          isTarget ? "text-accent-bright" : "text-ink-faint"
                        )}
                      >
                        {isTarget ? `Move to ${STAGE_SHORT[stage]}` : "Empty"}
                      </p>
                    ) : (
                      cards.map((prospect) => (
                        <ProspectCard
                          key={prospect.id}
                          prospect={prospect}
                          clients={clients}
                          todayISO={todayISO}
                          expanded={editing === prospect.id}
                          isDragging={dragging?.id === prospect.id}
                          onDragStart={() => setDragging(prospect)}
                          onDragEnd={() => {
                            setDragging(null);
                            setDropStage(null);
                          }}
                          onToggle={() =>
                            setEditing((id) => (id === prospect.id ? null : prospect.id))
                          }
                          onMove={(next) => run(() => moveProspect({ id: prospect.id, stage: next }))}
                          onWin={() => setWinning(prospect)}
                          onLose={() => setLosing(prospect)}
                          onSave={(values) =>
                            run(
                              () => updateProspect({ id: prospect.id, ...values }),
                              () => setEditing(null)
                            )
                          }
                          onDelete={() =>
                            run(() => deleteProspect(prospect.id), () => setEditing(null))
                          }
                        />
                      ))
                    )}

                    {/* A column with cards still needs somewhere to aim at. */}
                    {isTarget && cards.length > 0 ? (
                      <p className="rounded border border-dashed border-accent-bright/60 px-1 py-2 text-center text-[11px] text-accent-bright">
                        Move to {STAGE_SHORT[stage]}
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {won.length > 0 || lost.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowClosed((open) => !open)}
            className="text-xs text-ink-muted transition-colors hover:text-ink"
          >
            {showClosed ? "▾" : "▸"} Closed · {won.length} won, {lost.length} lost
          </button>

          {showClosed ? (
            <div className="mt-2 grid gap-3 lg:grid-cols-2">
              <Card title="Won" bodyClassName="p-2">
                <ul className="divide-y divide-line">
                  {won.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2 px-1 py-2">
                      <span className="text-xs text-ink">{p.name}</span>
                      <Badge tone="good">{SOURCE_LABELS[p.source]}</Badge>
                      <span className="tabular ml-auto text-[11px] text-ink-faint">
                        {formatDMY(p.won_on)} · {p.won_on ? diffDays(p.new_on, p.won_on) : "—"}d cycle
                      </span>
                    </li>
                  ))}
                  {won.length === 0 ? (
                    <li className="px-1 py-2 text-[11px] text-ink-faint">Nothing won yet.</li>
                  ) : null}
                </ul>
              </Card>

              <Card title="Lost" subtitle="Reasons are the point of this list." bodyClassName="p-2">
                <ul className="divide-y divide-line">
                  {lost.map((p) => (
                    <li key={p.id} className="px-1 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-ink">{p.name}</span>
                        <Badge>{SOURCE_LABELS[p.source]}</Badge>
                        <span className="tabular ml-auto text-[11px] text-ink-faint">
                          {formatDMY(p.lost_on)}
                        </span>
                        <button
                          type="button"
                          onClick={() => run(() => moveProspect({ id: p.id, stage: "conversation" }))}
                          className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-muted transition-colors hover:border-accent/40 hover:text-accent-bright"
                        >
                          Reopen
                        </button>
                      </div>
                      {p.lost_reason ? (
                        <p className="mt-0.5 text-[11px] text-ink-faint">{p.lost_reason}</p>
                      ) : null}
                    </li>
                  ))}
                  {lost.length === 0 ? (
                    <li className="px-1 py-2 text-[11px] text-ink-faint">Nothing lost yet.</li>
                  ) : null}
                </ul>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      {winning ? (
        <WinModal
          prospect={winning}
          todayISO={todayISO}
          onClose={() => setWinning(null)}
          onSubmit={(values) =>
            run(() => winProspect({ id: winning.id, ...values }), () => setWinning(null))
          }
        />
      ) : null}

      {losing ? (
        <LoseModal
          prospect={losing}
          onClose={() => setLosing(null)}
          onSubmit={(reason) =>
            run(() => loseProspect({ id: losing.id, reason }), () => setLosing(null))
          }
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

type EditValues = {
  name: string;
  source: Source;
  referred_by_client_id: string | null;
  est_setup_fee_myr: number;
  est_monthly_fee_myr: number;
  notes: string;
};

function ProspectCard({
  prospect,
  clients,
  todayISO,
  expanded,
  isDragging,
  onDragStart,
  onDragEnd,
  onToggle,
  onMove,
  onWin,
  onLose,
  onSave,
  onDelete,
}: {
  prospect: Prospect;
  clients: Client[];
  todayISO: string;
  expanded: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onToggle: () => void;
  onMove: (stage: Stage) => void;
  onWin: () => void;
  onLose: () => void;
  onSave: (values: EditValues) => void;
  onDelete: () => void;
}) {
  const stage = prospect.stage as OpenStage;
  const index = (OPEN_STAGES as readonly Stage[]).indexOf(stage);
  const forward = nextStage(stage);
  const enteredOn = stageDate(prospect, stage) ?? prospect.new_on;
  const daysInStage = diffDays(enteredOn, todayISO);
  const referrer = prospect.referred_by_client_id
    ? clients.find((c) => c.id === prospect.referred_by_client_id)?.client_name
    : null;

  return (
    <article
      // Not draggable while the edit panel is open: dragging would fight text
      // selection in the fields inside it.
      draggable={!expanded}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Firefox refuses to start a drag unless something is on the transfer.
        e.dataTransfer.setData("text/plain", prospect.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cx(
        "rounded-md border border-line bg-surface-2 p-2 transition-opacity",
        !expanded && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left text-xs font-medium text-ink transition-colors hover:text-accent-bright"
          title="Edit details"
        >
          {prospect.name}
        </button>
        <span className="tabular shrink-0 text-[10px] text-ink-faint" title={`In ${STAGE_LABELS[stage]} since ${formatDMY(enteredOn)}`}>
          {daysInStage}d
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1">
        <Badge>{SOURCE_LABELS[prospect.source]}</Badge>
        {referrer ? <span className="text-[10px] text-ink-faint">via {referrer}</span> : null}
        {prospect.est_monthly_fee_myr > 0 ? (
          <span className="tabular ml-auto text-[10px] text-ink-muted">
            {formatMYR(prospect.est_monthly_fee_myr)}/mo
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMove(OPEN_STAGES[index - 1])}
          disabled={index <= 0}
          aria-label="Move back a stage"
          className="rounded border border-line px-1.5 py-1 text-[11px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink disabled:opacity-25 disabled:hover:border-line"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() => (forward === "won" ? onWin() : forward ? onMove(forward) : undefined)}
          className={cx(
            "min-w-0 flex-1 truncate rounded px-1.5 py-1 text-[11px] font-medium transition-colors",
            forward === "won"
              ? "border border-good/40 bg-good/10 text-good hover:bg-good/20"
              : "border border-accent/40 bg-accent/10 text-accent-bright hover:bg-accent/20"
          )}
        >
          {forward === "won" ? "Won ✓" : `${STAGE_SHORT[forward!]} ›`}
        </button>

        <button
          type="button"
          onClick={onLose}
          aria-label="Mark lost"
          className="rounded border border-line px-1.5 py-1 text-[11px] text-ink-faint transition-colors hover:border-bad/40 hover:text-bad"
        >
          ✕
        </button>
      </div>

      {expanded ? (
        <EditPanel
          prospect={prospect}
          clients={clients}
          onCancel={onToggle}
          onSave={onSave}
          onDelete={onDelete}
          onWin={onWin}
        />
      ) : null}
    </article>
  );
}

function EditPanel({
  prospect,
  clients,
  onCancel,
  onSave,
  onDelete,
  onWin,
}: {
  prospect: Prospect;
  clients: Client[];
  onCancel: () => void;
  onSave: (values: EditValues) => void;
  onDelete: () => void;
  onWin: () => void;
}) {
  const [values, setValues] = useState<EditValues>({
    name: prospect.name,
    source: prospect.source,
    referred_by_client_id: prospect.referred_by_client_id,
    est_setup_fee_myr: prospect.est_setup_fee_myr,
    est_monthly_fee_myr: prospect.est_monthly_fee_myr,
    notes: prospect.notes ?? "",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(values);
      }}
      className="mt-2 space-y-2 border-t border-line pt-2"
    >
      <Fields values={values} setValues={setValues} clients={clients} />

      <p className="text-[10px] text-ink-faint">
        Entered {formatDMY(prospect.new_on)}
        {prospect.booked_on ? ` · booked ${formatDMY(prospect.booked_on)}` : ""}
      </p>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="submit"
          className="rounded bg-accent px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-accent-bright"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-line px-2 py-1 text-[11px] text-ink-muted transition-colors hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onWin}
          className="rounded border border-good/40 bg-good/10 px-2 py-1 text-[11px] text-good transition-colors hover:bg-good/20"
        >
          Won
        </button>
        {confirmDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto rounded border border-bad/40 bg-bad/10 px-2 py-1 text-[11px] text-bad"
          >
            Really delete
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="ml-auto rounded border border-line px-2 py-1 text-[11px] text-ink-faint transition-colors hover:border-bad/40 hover:text-bad"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shared field set
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none transition-colors focus:border-accent";

function Fields({
  values,
  setValues,
  clients,
}: {
  values: EditValues;
  setValues: (next: EditValues) => void;
  clients: Client[];
}) {
  const money = (raw: string) => {
    const n = Number(raw.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  return (
    <div className="space-y-2">
      <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
        Company
        <input
          type="text"
          required
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          className={cx(inputClass, "mt-0.5")}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
          Source
          <select
            value={values.source}
            onChange={(e) => setValues({ ...values, source: e.target.value as Source })}
            className={cx(inputClass, "mt-0.5")}
          >
            {SOURCES.map((source) => (
              <option key={source} value={source} className="bg-surface text-ink">
                {SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </label>

        {values.source === "referral" ? (
          <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
            Referred by
            <select
              value={values.referred_by_client_id ?? ""}
              onChange={(e) =>
                setValues({ ...values, referred_by_client_id: e.target.value || null })
              }
              className={cx(inputClass, "mt-0.5")}
            >
              <option value="" className="bg-surface text-ink">
                Unknown
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id} className="bg-surface text-ink">
                  {client.client_name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
          Est. setup (RM)
          <input
            type="text"
            inputMode="decimal"
            value={values.est_setup_fee_myr || ""}
            onChange={(e) => setValues({ ...values, est_setup_fee_myr: money(e.target.value) })}
            placeholder="0"
            className={cx(inputClass, "tabular mt-0.5 text-right")}
          />
        </label>
        <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
          Est. monthly (RM)
          <input
            type="text"
            inputMode="decimal"
            value={values.est_monthly_fee_myr || ""}
            onChange={(e) => setValues({ ...values, est_monthly_fee_myr: money(e.target.value) })}
            placeholder="0"
            className={cx(inputClass, "tabular mt-0.5 text-right")}
          />
        </label>
      </div>

      <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
        Notes
        <textarea
          rows={2}
          value={values.notes}
          onChange={(e) => setValues({ ...values, notes: e.target.value })}
          className={cx(inputClass, "mt-0.5 resize-y")}
        />
      </label>
    </div>
  );
}

function ProspectForm({
  clients,
  todayISO,
  onCancel,
  onSubmit,
}: {
  clients: Client[];
  todayISO: string;
  onCancel: () => void;
  onSubmit: (values: EditValues & { new_on: string }) => void;
}) {
  const [values, setValues] = useState<EditValues>({
    name: "",
    source: "xhs",
    referred_by_client_id: null,
    est_setup_fee_myr: 0,
    est_monthly_fee_myr: 0,
    notes: "",
  });
  const [startedOn, setStartedOn] = useState(todayISO);

  return (
    <Card title="New prospect" subtitle="Enters at New. Everything else derives from here.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ ...values, new_on: startedOn });
        }}
        className="max-w-md space-y-3"
      >
        <Fields values={values} setValues={setValues} clients={clients} />

        {/* Backdatable, because the first thing anyone does with this page is
            enter deals that started weeks ago. Defaults to today. */}
        <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
          First contact
          <input
            type="date"
            value={startedOn}
            max={todayISO}
            onChange={(e) => setStartedOn(e.target.value || todayISO)}
            className={cx(inputClass, "tabular mt-0.5 w-40")}
          />
          <span className="mt-0.5 block text-[10px] normal-case tracking-normal text-ink-faint">
            The day this became a real prospect. Sales cycle is measured from here.
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-bright"
          >
            Add prospect
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface shadow-xl">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p> : null}
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function WinModal({
  prospect,
  todayISO,
  onClose,
  onSubmit,
}: {
  prospect: Prospect;
  todayISO: string;
  onClose: () => void;
  onSubmit: (values: {
    setup_fee_myr: number;
    monthly_fee_myr: number;
    go_live_date: string | null;
    won_on: string;
  }) => void;
}) {
  const [setup, setSetup] = useState(String(prospect.est_setup_fee_myr || ""));
  const [monthly, setMonthly] = useState(String(prospect.est_monthly_fee_myr || ""));
  const [goLive, setGoLive] = useState("");
  const [wonOn, setWonOn] = useState(todayISO);

  const money = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  return (
    <Modal
      title={`Won — ${prospect.name}`}
      subtitle="Creates the client and the build. Asked once, never again."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            setup_fee_myr: money(setup),
            monthly_fee_myr: money(monthly),
            go_live_date: goLive || null,
            won_on: wonOn,
          });
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
            Actual setup (RM)
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={setup}
              onChange={(e) => setSetup(e.target.value.replace(/[^\d.]/g, ""))}
              className={cx(inputClass, "tabular mt-0.5 text-right")}
            />
          </label>
          <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
            Actual monthly (RM)
            <input
              type="text"
              inputMode="decimal"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value.replace(/[^\d.]/g, ""))}
              className={cx(inputClass, "tabular mt-0.5 text-right")}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
            Won on
            <input
              type="date"
              value={wonOn}
              max={todayISO}
              onChange={(e) => setWonOn(e.target.value)}
              className={cx(inputClass, "tabular mt-0.5")}
            />
          </label>
          <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
            Go-live target
            <input
              type="date"
              value={goLive}
              onChange={(e) => setGoLive(e.target.value)}
              className={cx(inputClass, "tabular mt-0.5")}
            />
          </label>
        </div>

        <p className="text-[11px] text-ink-faint">
          Close-to-live is measured from the won date to the go-live date. Leave go-live blank and
          the build still gets a target from the close-to-live setting.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md bg-good px-3 py-1.5 text-xs font-medium text-[#062015] transition-opacity hover:opacity-90"
          >
            Create client
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LoseModal({
  prospect,
  onClose,
  onSubmit,
}: {
  prospect: Prospect;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      title={`Lost — ${prospect.name}`}
      subtitle="The reason is the only thing a lost deal leaves behind."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(reason);
        }}
        className="space-y-3"
      >
        <label className="block text-[10px] uppercase tracking-wide text-ink-faint">
          Reason (required)
          <textarea
            required
            autoFocus
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Went with an in-house hire. Price was not the objection."
            className={cx(inputClass, "mt-0.5 resize-y")}
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md border border-bad/40 bg-bad/10 px-3 py-1.5 text-xs font-medium text-bad transition-colors hover:bg-bad/20"
          >
            Mark lost
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
