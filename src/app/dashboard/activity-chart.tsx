"use client";

import { CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActivityPoint, ActivitySeries } from "@/lib/metrics";
import { formatDM, formatDMY, formatWeekOf } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { axisProps, CHROME, DIVERGING, gridProps, ROLLING_AVERAGE_COLOR, SECONDARY_SERIES } from "@/lib/chart-theme";
import { EmptyState } from "@/components/ui";
import { ChartFrame, DataTable, Legend, TooltipCard } from "@/components/chart-frame";

const CHART_MARGIN = { top: 8, right: 16, bottom: 0, left: 0 } as const;

const SERIES = [
  { key: "outreach", label: "Outreach", color: CHROME.accentBright },
  { key: "followUp", label: "Follow-up", color: SECONDARY_SERIES },
  { key: "meetingsBooked", label: "Meetings booked", color: DIVERGING.positive },
  { key: "meetingsAttended", label: "Meetings attended", color: ROLLING_AVERAGE_COLOR },
] as const satisfies readonly { key: keyof Omit<ActivityPoint, "key">; label: string; color: string }[];

/** Trend for all four daily numbers — daily points for a month or less, weekly beyond that. */
export function ActivityTrendChart({ series }: { series: ActivitySeries }) {
  const { bucket, points } = series;
  const hasData = points.some((p) => p.outreach || p.followUp || p.meetingsBooked || p.meetingsAttended);
  const formatKey = bucket === "day" ? formatDM : formatWeekOf;
  const formatHeading = bucket === "day" ? formatDMY : formatWeekOf;

  return (
    <ChartFrame
      title="Activity trend"
      subtitle={bucket === "day" ? "Daily counts over the selected range." : "Weekly totals over the selected range."}
      legend={<Legend items={SERIES.map((s) => ({ label: s.label, color: s.color }))} />}
      chart={
        hasData ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={CHART_MARGIN}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="key" {...axisProps} tickFormatter={formatKey} />
                <YAxis {...axisProps} width={32} allowDecimals={false} />
                <Tooltip
                  cursor={{ stroke: CHROME.axis, strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as ActivityPoint;
                    return (
                      <TooltipCard
                        heading={formatHeading(point.key)}
                        rows={SERIES.map((s) => ({
                          label: s.label,
                          value: formatNumber(point[s.key]),
                          color: s.color,
                        }))}
                      />
                    );
                  }}
                />
                {SERIES.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={points.length <= 14 ? { r: 3, fill: s.color, stroke: CHROME.surface, strokeWidth: 1 } : false}
                    activeDot={{ r: 4, fill: s.color, stroke: CHROME.surface, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState compact title="Nothing logged in this range." hint="Log a day on Entry to see it here." />
        )
      }
      table={
        <DataTable
          columns={[
            { key: "date", label: bucket === "day" ? "Day" : "Week" },
            ...SERIES.map((s) => ({ key: s.key, label: s.label, align: "right" as const })),
          ]}
          rows={points.map((point) => ({
            date: formatHeading(point.key),
            outreach: formatNumber(point.outreach),
            followUp: formatNumber(point.followUp),
            meetingsBooked: formatNumber(point.meetingsBooked),
            meetingsAttended: formatNumber(point.meetingsAttended),
          }))}
        />
      }
    />
  );
}
