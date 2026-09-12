import { Skeleton } from "@/components/ui";

export default function ScriptsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-64" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="rounded-lg border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
