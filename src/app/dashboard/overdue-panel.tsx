import Link from "next/link";
import { formatDMY } from "@/lib/dates";
import { formatRatio } from "@/lib/format";
import { PROJECT_STATUS_LABELS, type Project } from "@/lib/types";
import { Badge, Card, EmptyState } from "@/components/ui";

export type OverdueEntry = { project: Project; clientName: string; lateBy: number };

/**
 * Delivery load and the list of projects past their target date.
 *
 * Load is active projects per active client — it says how much delivery each
 * paying client is carrying, which is the number that predicts a fulfilment
 * bottleneck before the delivery-time average moves.
 */
export function OverduePanel({
  load,
  activeProjects,
  activeClients,
  overdue,
}: {
  load: number | null;
  activeProjects: number;
  activeClients: number;
  overdue: OverdueEntry[];
}) {
  return (
    <Card
      title="Delivery load"
      subtitle={`${activeProjects} active project${activeProjects === 1 ? "" : "s"} across ${activeClients} client${activeClients === 1 ? "" : "s"}`}
      action={
        <Link
          href="/clients"
          className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          Open register →
        </Link>
      }
      bodyClassName="p-4"
    >
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-3xl font-semibold tracking-tight text-ink">{formatRatio(load)}</span>
        <span className="text-xs text-ink-faint">active projects per active client</span>
      </div>

      <h4 className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-muted">
        Past target date
        {overdue.length > 0 ? <Badge tone="bad">{overdue.length}</Badge> : null}
      </h4>

      {overdue.length === 0 ? (
        <EmptyState compact title="Nothing is past its target date." />
      ) : (
        <ul className="space-y-1.5">
          {overdue.map(({ project, clientName, lateBy }) => (
            <li
              key={project.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-bad/40 bg-bad/5 px-2.5 py-1.5"
            >
              <span className="text-xs text-ink">{clientName}</span>
              <span aria-hidden className="text-ink-faint">
                ·
              </span>
              <span className="min-w-0 truncate text-xs text-ink-muted" title={project.project_name}>
                {project.project_name}
              </span>
              <span className="ml-auto flex items-center gap-2">
                <span className="tabular text-[11px] text-ink-faint">
                  target {formatDMY(project.target_date)}
                </span>
                <Badge tone={project.status === "blocked" ? "bad" : "neutral"}>
                  {PROJECT_STATUS_LABELS[project.status]}
                </Badge>
                {/* Icon plus label, so the red is never carrying the meaning alone. */}
                <Badge tone="bad">⚠ {lateBy}d late</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
