import { Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 pb-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-full rounded-md" />

      {/* The goal block. Tallest thing on the page, loading or not. */}
      <Skeleton className="h-56 w-full rounded-lg" />

      <div className="space-y-2.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-3 xl:grid-cols-2">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-3 xl:grid-cols-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[86px] rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
