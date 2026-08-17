"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyRevenuePoint } from "@/lib/metrics";
import { formatMonthKey, formatMonthKeyShort } from "@/lib/dates";
import { formatMYR, formatMYRCompact } from "@/lib/format";
import {
  axisProps,
  CHROME,
  DIVERGING,
  gridProps,
  ROLLING_AVERAGE_COLOR,
} from "@/lib/chart-theme";
import { EmptyState } from "@/components/ui";
import { ChartFrame, DataTable, Legend, TooltipCard } from "@/components/chart-frame";

const BAR_CAP = 24;

/**
 * Money axes need room for "RM 180k" — at a narrower width the tick wraps onto
 * two lines and collides with its neighbour.
 */
const MONEY_AXIS_WIDTH = 72;
const CHART_MARGIN = { top: 8, right: 16, bottom: 0, left: 0 } as const;

/** MRR at each month end. One series, so no legend — the title names it. */
export function MrrTrendChart({ points }: { points: MonthlyRevenuePoint[] }) {
  const hasData = points.some((p) => p.mrr > 0);

  return (
    <ChartFrame
      title="MRR by month"
      subtitle="Monthly fees still active at each month end."
      chart={
        hasData ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={CHART_MARGIN}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} tickFormatter={formatMonthKeyShort} />
                <YAxis {...axisProps} width={MONEY_AXIS_WIDTH} tickFormatter={formatMYRCompact} />
                <Tooltip
                  cursor={{ stroke: CHROME.axis, strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as MonthlyRevenuePoint;
                    return (
                      <TooltipCard
                        heading={formatMonthKey(point.month)}
                        rows={[
                          {
                            label: "MRR",
                            value: formatMYR(point.mrr),
                            color: DIVERGING.positive,
                            emphasis: true,
                          },
                          { label: "Net change", value: formatMYR(point.netMrrChange) },
                        ]}
                      />
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="mrr"
                  stroke={DIVERGING.positive}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // Dots on every month: they mark the endpoint (the value the eye
                  // goes to) and keep a single-month range from rendering as an
                  // invisible zero-length line. Monthly buckets are never dense.
                  dot={{ r: 4, fill: DIVERGING.positive, stroke: CHROME.surface, strokeWidth: 2 }}
                  activeDot={{
                    r: 4,
                    fill: DIVERGING.positive,
                    stroke: CHROME.surface,
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState compact title="No active MRR in this range." />
        )
      }
      table={
        <DataTable
          columns={[
            { key: "month", label: "Month" },
            { key: "mrr", label: "MRR", align: "right" },
            { key: "net", label: "Net change", align: "right" },
          ]}
          rows={points.map((point) => ({
            month: formatMonthKey(point.month),
            mrr: formatMYR(point.mrr),
            net: formatMYR(point.netMrrChange),
          }))}
        />
      }
    />
  );
}

/** New vs churned MRR — a polarity, so a diverging pair around a zero baseline. */
export function MrrMovementChart({ points }: { points: MonthlyRevenuePoint[] }) {
  const hasData = points.some((p) => p.newMrr > 0 || p.churnedMrr < 0);

  return (
    <ChartFrame
      title="MRR movement"
      subtitle="New MRR added against MRR churned, per month."
      legend={
        hasData ? (
          <Legend
            items={[
              { label: "New MRR", color: DIVERGING.positive },
              { label: "Churned MRR", color: DIVERGING.negative },
              { label: "Net change", color: ROLLING_AVERAGE_COLOR, dashed: true },
            ]}
          />
        ) : undefined
      }
      chart={
        hasData ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {/* Net change shares the axis with the bars — same unit, same scale,
                  so it is an overlay rather than a second y-axis. */}
              <ComposedChart data={points} margin={CHART_MARGIN} barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="month"
                  {...axisProps}
                  tickFormatter={formatMonthKeyShort}
                  axisLine={false}
                />
                <YAxis {...axisProps} width={MONEY_AXIS_WIDTH} tickFormatter={formatMYRCompact} />
                <ReferenceLine y={0} stroke={CHROME.axis} strokeWidth={1} />
                <Tooltip
                  cursor={{ fill: CHROME.grid, fillOpacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as MonthlyRevenuePoint;
                    return (
                      <TooltipCard
                        heading={formatMonthKey(point.month)}
                        rows={[
                          {
                            label: "New MRR",
                            value: formatMYR(point.newMrr),
                            color: DIVERGING.positive,
                          },
                          {
                            label: "Churned MRR",
                            value: formatMYR(point.churnedMrr),
                            color: DIVERGING.negative,
                          },
                          {
                            label: "Net change",
                            value: formatMYR(point.netMrrChange),
                            emphasis: true,
                          },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="newMrr"
                  fill={DIVERGING.positive}
                  maxBarSize={BAR_CAP}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="churnedMrr"
                  fill={DIVERGING.negative}
                  maxBarSize={BAR_CAP}
                  radius={[0, 0, 4, 4]}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="netMrrChange"
                  stroke={ROLLING_AVERAGE_COLOR}
                  strokeWidth={2}
                  strokeLinecap="round"
                  dot={{
                    r: 4,
                    fill: ROLLING_AVERAGE_COLOR,
                    stroke: CHROME.surface,
                    strokeWidth: 2,
                  }}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState compact title="No MRR gained or lost in this range." />
        )
      }
      table={
        <DataTable
          columns={[
            { key: "month", label: "Month" },
            { key: "added", label: "New MRR", align: "right" },
            { key: "churned", label: "Churned MRR", align: "right" },
            { key: "net", label: "Net", align: "right" },
          ]}
          rows={points.map((point) => ({
            month: formatMonthKey(point.month),
            added: formatMYR(point.newMrr),
            churned: formatMYR(point.churnedMrr),
            net: formatMYR(point.netMrrChange),
          }))}
        />
      }
    />
  );
}

/** Cash collected = setup fees closed in the month + that month's MRR. */
export function CashCollectedChart({ points }: { points: MonthlyRevenuePoint[] }) {
  const hasData = points.some((p) => p.cashCollected > 0);

  return (
    <ChartFrame
      title="Cash collected by month"
      subtitle="Setup fees closed in the month plus that month's MRR."
      chart={
        hasData ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={CHART_MARGIN}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} tickFormatter={formatMonthKeyShort} />
                <YAxis {...axisProps} width={MONEY_AXIS_WIDTH} tickFormatter={formatMYRCompact} />
                <Tooltip
                  cursor={{ fill: CHROME.grid, fillOpacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as MonthlyRevenuePoint;
                    return (
                      <TooltipCard
                        heading={formatMonthKey(point.month)}
                        rows={[
                          { label: "Setup fees", value: formatMYR(point.setupFees) },
                          { label: "MRR", value: formatMYR(point.mrr) },
                          {
                            label: "Cash collected",
                            value: formatMYR(point.cashCollected),
                            emphasis: true,
                          },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="cashCollected"
                  fill={CHROME.accent}
                  maxBarSize={BAR_CAP}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState compact title="No cash collected in this range." />
        )
      }
      table={
        <DataTable
          columns={[
            { key: "month", label: "Month" },
            { key: "setup", label: "Setup fees", align: "right" },
            { key: "mrr", label: "MRR", align: "right" },
            { key: "cash", label: "Cash collected", align: "right" },
          ]}
          rows={points.map((point) => ({
            month: formatMonthKey(point.month),
            setup: formatMYR(point.setupFees),
            mrr: formatMYR(point.mrr),
            cash: formatMYR(point.cashCollected),
          }))}
        />
      }
    />
  );
}
