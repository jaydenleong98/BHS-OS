import { Skeleton } from "@/components/ui";

export default function AnalysisLoading() {
  return (
    <div className="space-y-6 pb-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-10 w-full rounded-md" />

      <div className="space-y-2.5">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[86px] rounded-lg" />
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-4 w-20" />
        <div className="grid gap-3 xl:grid-cols-2">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  );
}
