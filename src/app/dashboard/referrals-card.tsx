"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDMY } from "@/lib/dates";
import { formatMYR, formatNumber } from "@/lib/format";
import type { ReferralSummary } from "@/lib/metrics";
import { STAGE_LABELS } from "@/lib/types";
import { Badge, Card, cx, EmptyState } from "@/components/ui";
import { logReferralAsk } from "./actions";

/**
 * Referrals: the highest-converting source and the least-used one.
 *
 * The counter is the point. An ask is a thing I do in a conversation, and unless
 * logging it costs one click it never gets logged at all — so the ask button
 * lives here, on the page I already have open, rather than behind a form.
 */
export function ReferralsCard({
  referrals,
  askOptions,
}: {
  referrals: ReferralSummary;
  askOptions: { id: string; name: string; lastAsked: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  function log(clientId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await logReferralAsk({ client_id: clientId });
      if (!result.ok) setError(result.error);
      else {
        setPicking(false);
        router.refresh();
      }
    });
  }

  const received = referrals.received.slice(0, 5);

  return (
    <Card
      title="Referrals"
      subtitle="Asks made this month, and what came back."
      className={cx(pending && "opacity-70 transition-opacity")}
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">Asks this month</div>
          <div className="tabular mt-0.5 text-3xl font-semibold text-ink">
            {formatNumber(referrals.asksThisMonth)}
          </div>
          <div className="text-[11px] text-ink-faint">
            {formatNumber(referrals.asksLastMonth)} last month
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">Received</div>
          <div className="tabular mt-0.5 text-3xl font-semibold text-ink">
            {formatNumber(referrals.received.length)}
          </div>
          <div className="text-[11px] text-ink-faint">
            {formatNumber(referrals.wonFromReferral)} became clients
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">Referred MRR</div>
          <div className="tabular mt-0.5 text-3xl font-semibold text-accent-bright">
            {formatMYR(referrals.referredMrr)}
          </div>
          <div className="text-[11px] text-ink-faint">
            {formatMYR(referrals.referredContractValue)} booked all time
          </div>
        </div>

        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setPicking((open) => !open)}
            className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent-bright transition-colors hover:bg-accent/20"
          >
            + Log an ask
          </button>
        </div>
      </div>

      {picking ? (
        <div className="mt-3 rounded-md border border-line bg-surface-2 p-2">
          <p className="mb-1.5 text-[11px] text-ink-faint">Who did you ask?</p>
          <div className="flex flex-wrap gap-1.5">
            {askOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => log(option.id)}
                className="rounded border border-line bg-surface px-2 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent/40 hover:text-accent-bright"
                title={
                  option.lastAsked ? `Last asked ${formatDMY(option.lastAsked)}` : "Never asked"
                }
              >
                {option.name}
                {option.lastAsked ? null : <span className="ml-1 text-warn">·new</span>}
              </button>
            ))}
            <button
              type="button"
              onClick={() => log(null)}
              className="rounded border border-line bg-surface px-2 py-1 text-[11px] text-ink-faint transition-colors hover:text-ink"
            >
              Someone else
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 rounded-md border border-bad/40 bg-bad/10 px-2 py-1.5 text-xs text-bad">
          {error}
        </p>
      ) : null}

      <div className="mt-4 border-t border-line pt-3">
        <h4 className="mb-2 text-[11px] uppercase tracking-wide text-ink-faint">
          Referrals received
        </h4>

        {received.length === 0 ? (
          <EmptyState
            compact
            title="No referrals logged yet."
            hint="A prospect with source Referral shows up here, along with the client who sent them."
          />
        ) : (
          <ul className="space-y-1">
            {received.map(({ prospect, referrerName, won }) => (
              <li
                key={prospect.id}
                className="flex flex-wrap items-center gap-2 rounded border border-line bg-surface-2 px-2 py-1.5"
              >
                <span className="text-xs text-ink">{prospect.name}</span>
                <span className="text-[11px] text-ink-faint">
                  via {referrerName ?? "unknown"}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="tabular text-[11px] text-ink-faint">
                    {formatDMY(prospect.new_on)}
                  </span>
                  <Badge tone={won ? "good" : "neutral"}>{STAGE_LABELS[prospect.stage]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}

        {referrals.neverAsked.length > 0 ? (
          <p className="mt-2 text-[11px] text-warn">
            {referrals.neverAsked.length} active{" "}
            {referrals.neverAsked.length === 1 ? "client has" : "clients have"} never been asked.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
