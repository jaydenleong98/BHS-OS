"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyCompletionPoint } from "@/lib/metrics";
import { formatMonthKey, formatMonthKeyShort } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { axisProps, CHROME, gridProps } from "@/lib/chart-theme";
import { EmptyState } from "@/components/ui";
import { ChartFrame, DataTable, TooltipCard } from "./chart-frame";

/** Projects delivered per month. One series, so no legend. */
export function CompletionsChart({ points }: { points: MonthlyCompletionPoint[] }) {
  const hasData = points.some((p) => p.completed > 0);

  return (
    <ChartFrame
      title="Projects completed by month"
      subtitle="Counted on completion date."
      chart={
        hasData ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} tickFormatter={formatMonthKeyShort} />
                <YAxis {...axisProps} width={40} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: CHROME.grid, fillOpacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as MonthlyCompletionPoint;
                    return (
                      <TooltipCard
                        heading={formatMonthKey(point.month)}
                        rows={[
                          {
                            label: "Completed",
                            value: formatNumber(point.completed),
                            color: CHROME.accent,
                            emphasis: true,
                          },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="completed"
                  fill={CHROME.accent}
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            compact
            title="No projects completed in this range."
            hint="Mark projects done from the Clients register and they appear here."
          />
        )
      }
      table={
        <DataTable
          columns={[
            { key: "month", label: "Month" },
            { key: "completed", label: "Completed", align: "right" },
          ]}
          rows={points.map((point) => ({
            month: formatMonthKey(point.month),
            completed: formatNumber(point.completed),
          }))}
        />
      }
    />
  );
}
