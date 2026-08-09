import { Skeleton } from "@/components/ui";

export default function ClientsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-3 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[86px] rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-9 w-80 max-w-full rounded-md" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
