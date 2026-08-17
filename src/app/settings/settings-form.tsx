"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endOfYear, formatDMY } from "@/lib/dates";
import { formatMYR } from "@/lib/format";
import type { AppSettings } from "@/lib/types";
import { Card, cx } from "@/components/ui";
import { saveSettings, wipeAllData } from "./actions";

type Group = {
  title: string;
  hint: string;
  fields: {
    key: keyof AppSettings;
    label: string;
    hint: string;
    suffix?: string;
  }[];
};

const GROUPS: Group[] = [
  {
    title: "The goal",
    hint: "The gap between target and current MRR is the largest number on the dashboard.",
    fields: [
      {
        key: "target_mrr_myr",
        label: "Target MRR",
        hint: "Monthly recurring revenue you are aiming at.",
        suffix: "RM",
      },
    ],
  },
  {
    title: "Capacity",
    hint: "The only place in this app where a bigger number is a worse number.",
    fields: [
      {
        key: "active_build_ceiling",
        label: "Active build ceiling",
        hint: "At or above this, the dashboard says pause selling.",
      },
      {
        key: "close_to_live_target_days",
        label: "Close-to-live target",
        hint: "Days from won to go-live.",
        suffix: "days",
      },
    ],
  },
  {
    title: "Weekly content targets",
    hint: "Vaneese's targets, shown on her entry tab and on the dashboard.",
    fields: [
      { key: "content_target_per_week", label: "Content posted", suffix: "/week", hint: "" },
      { key: "blog_target_per_week", label: "Blog posts", suffix: "/week", hint: "" },
    ],
  },
  {
    title: "Daily effort targets",
    hint: "Shown beside the four fields on the entry page. Sales calls taken has no target by design.",
    fields: [
      { key: "outreach_target_per_day", label: "Outreach", suffix: "/day", hint: "" },
      { key: "conversations_target_per_day", label: "Conversations", suffix: "/day", hint: "" },
      { key: "deep_work_target_per_day", label: "Deep work blocks", suffix: "/day", hint: "" },
    ],
  },
];

export function SettingsForm({
  settings,
  todayISO,
  recordCount,
}: {
  settings: AppSettings;
  todayISO: string;
  recordCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(values) !== JSON.stringify(settings);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveSettings(values);
      if (!result.ok) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const numberField = (key: keyof AppSettings) => ({
    value: String(values[key] ?? ""),
    onChange: (raw: string) => {
      const cleaned = raw.replace(/[^\d.]/g, "");
      setValues({ ...values, [key]: cleaned === "" ? 0 : Number(cleaned) });
      setSaved(false);
    },
  });

  return (
    <div className="space-y-4">
      {GROUPS.map((group) => (
        <Card key={group.title} title={group.title} subtitle={group.hint}>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((field) => {
              const bound = numberField(field.key);
              return (
                <label key={String(field.key)} className="block">
                  <span className="text-xs text-ink-muted">{field.label}</span>
                  <span className="mt-1 flex items-center gap-2">
                    {field.suffix === "RM" ? (
                      <span className="text-xs text-ink-faint">RM</span>
                    ) : null}
                    <input
                      type="text"
                      inputMode="decimal"
                      value={bound.value}
                      onChange={(e) => bound.onChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="tabular w-32 rounded-md border border-line bg-surface-2 px-3 py-2 text-right text-sm outline-none transition-colors focus:border-accent focus:bg-surface-3"
                    />
                    {field.suffix && field.suffix !== "RM" ? (
                      <span className="text-xs text-ink-faint">{field.suffix}</span>
                    ) : null}
                  </span>
                  {field.hint ? (
                    <span className="mt-1 block text-[11px] text-ink-faint">{field.hint}</span>
                  ) : null}
                </label>
              );
            })}

            {group.title === "The goal" ? (
              <label className="block">
                <span className="text-xs text-ink-muted">Deadline</span>
                <input
                  type="date"
                  value={values.goal_deadline ?? ""}
                  onChange={(e) => {
                    setValues({ ...values, goal_deadline: e.target.value || null });
                    setSaved(false);
                  }}
                  className="tabular mt-1 block rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                />
                <span className="mt-1 block text-[11px] text-ink-faint">
                  Blank means 31 Dec of the current year — {formatDMY(endOfYear(todayISO))}.
                </span>
              </label>
            ) : null}
          </div>

          {group.title === "The goal" && values.target_mrr_myr > 0 ? (
            <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-faint">
              Dashboard will show the gap to {formatMYR(values.target_mrr_myr)}.
            </p>
          ) : null}
        </Card>
      ))}

      {error ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-bright disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        <span aria-live="polite" className="text-xs">
          {saved && !dirty ? (
            <span className="text-good">✓ Saved</span>
          ) : dirty ? (
            <span className="text-warn">Unsaved changes</span>
          ) : (
            <span className="text-ink-faint">Up to date</span>
          )}
        </span>
      </div>

      <DangerZone recordCount={recordCount} />
    </div>
  );
}

/**
 * Start clean.
 *
 * The app shipped with generated demo data — fake clients, fake MRR — and there
 * is no safe way to half-remove that. This deletes every prospect, client,
 * build, entry, spend row and referral ask in one go, keeping only the settings
 * above.
 */
function DangerZone({ recordCount }: { recordCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function wipe() {
    setError(null);
    startTransition(async () => {
      const result = await wipeAllData(confirmation);
      if (!result.ok) setError(result.error);
      else {
        setDone(true);
        setOpen(false);
        setConfirmation("");
        router.refresh();
      }
    });
  }

  return (
    <Card
      title="Start clean"
      subtitle="Deletes every record. Targets and ceilings above are kept."
      className="border-bad/30"
    >
      <p className="text-xs text-ink-muted">
        There {recordCount === 1 ? "is" : "are"}{" "}
        <span className="tabular font-semibold text-ink">{recordCount}</span> record
        {recordCount === 1 ? "" : "s"} across prospects, clients, builds, daily entries, weekly
        content, spend and referral asks. This removes all of them, including anything left from the
        demo dataset the app used to ship with.
      </p>

      {done ? (
        <p className="mt-2 text-xs text-good">✓ All records deleted.</p>
      ) : null}

      {open ? (
        <div className="mt-3 space-y-2 rounded-md border border-bad/40 bg-bad/5 p-3">
          <label className="block text-xs text-bad">
            Type DELETE to confirm. This cannot be undone.
            <input
              type="text"
              autoFocus
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="mt-1 w-40 rounded border border-bad/40 bg-surface-2 px-2 py-1 text-sm text-ink outline-none focus:border-bad"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={wipe}
              disabled={pending || confirmation.trim().toUpperCase() !== "DELETE"}
              className={cx(
                "rounded-md border border-bad/50 bg-bad/15 px-3 py-1.5 text-xs font-medium text-bad transition-colors",
                "hover:bg-bad/25 disabled:opacity-40 disabled:hover:bg-bad/15"
              )}
            >
              {pending ? "Deleting…" : "Delete everything"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmation("");
              }}
              className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-bad">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className="mt-3 rounded-md border border-bad/40 px-3 py-1.5 text-xs text-bad transition-colors hover:bg-bad/10"
        >
          Wipe all data…
        </button>
      )}
    </Card>
  );
}
