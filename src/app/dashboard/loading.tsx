import { Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 pb-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-full rounded-md" />

      <div className="space-y-2.5">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[86px] rounded-lg" />
          ))}
        </div>
      </div>

      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
