"use client";

import { useEffect, useRef, useState } from "react";
import { SOURCES, SOURCE_LABELS, TIERS, TIER_LABELS, type Source, type Tier } from "@/lib/types";
import { logDeal } from "./actions";

export function DealModal({
  defaultCloseDate,
  maxDate,
  onClose,
  onSaved,
}: {
  defaultCloseDate: string;
  maxDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientName, setClientName] = useState("");
  const [closeDate, setCloseDate] = useState(defaultCloseDate);
  const [source, setSource] = useState<Source>("referral");
  const [tier, setTier] = useState<Tier | "">("growth");
  const [setupFee, setSetupFee] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    // Stop the page behind the modal from scrolling under it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const result = await logDeal({
      client_name: clientName,
      close_date: closeDate,
      source,
      tier,
      setup_fee_myr: Number(setupFee) || 0,
      monthly_fee_myr: Number(monthlyFee) || 0,
      notes,
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  const money = (value: string, set: (v: string) => void) => ({
    type: "text" as const,
    inputMode: "decimal" as const,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")),
    placeholder: "0.00",
    className:
      "tabular w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-right text-sm outline-none transition-colors focus:border-accent",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (!dialogRef.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-modal-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-line bg-surface sm:rounded-xl"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="deal-modal-title" className="text-sm font-semibold tracking-tight">
            Log a closed deal
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded px-2 py-1 text-sm text-ink-faint transition-colors hover:text-ink"
          >
            ✕
          </button>
        </header>

        <form onSubmit={submit} className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Client name</span>
            <input
              type="text"
              required
              autoFocus
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Aurora Dental Klang"
              className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-faint/60 focus:border-accent"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">Close date</span>
              <input
                type="date"
                required
                value={closeDate}
                max={maxDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="tabular w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">Source</span>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as Source)}
                className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Tier</span>
            <div className="grid grid-cols-4 gap-1.5">
              {TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={[
                    "rounded-md border px-2 py-1.5 text-xs transition-colors",
                    tier === t
                      ? "border-accent bg-accent/15 text-accent-bright"
                      : "border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:text-ink",
                  ].join(" ")}
                >
                  {TIER_LABELS[t]}
                </button>
              ))}
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">Setup fee (RM)</span>
              <input {...money(setupFee, setSetupFee)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                Monthly fee (RM)
              </span>
              <input {...money(monthlyFee, setMonthlyFee)} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional — what closed it, what they need."
              className="w-full resize-y rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-faint/60 focus:border-accent"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
              {error}
            </p>
          ) : null}

          <p className="text-xs text-ink-faint">
            The client starts as <span className="text-ink-muted">active</span>. Add its project and
            change status from the Clients register.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-bright disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save deal"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-3 py-2 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
