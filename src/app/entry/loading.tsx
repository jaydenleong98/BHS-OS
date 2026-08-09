import { Skeleton } from "@/components/ui";
import { SOURCES } from "@/lib/types";

export default function EntryLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-9 w-56" />
      </div>

      <Skeleton className="h-14 w-full rounded-lg" />

      <div className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-2 p-3">
          {SOURCES.map((source) => (
            <Skeleton key={source} className="h-9 w-full" />
          ))}
        </div>
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}
