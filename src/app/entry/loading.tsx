import { Skeleton } from "@/components/ui";

export default function EntryLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-48" />
      </div>

      <Skeleton className="h-8 w-64 rounded-md" />
      <Skeleton className="h-9 w-full rounded-md" />
      <Skeleton className="h-14 w-full rounded-lg" />

      <div className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2 p-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}
