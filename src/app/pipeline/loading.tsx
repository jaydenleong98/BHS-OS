import { Skeleton } from "@/components/ui";
import { OPEN_STAGES } from "@/lib/types";

export default function PipelineLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-96" />
      </div>

      <Skeleton className="h-9 w-64 rounded-md" />

      <div className="grid grid-cols-5 gap-2">
        {OPEN_STAGES.map((stage) => (
          <Skeleton key={stage} className="h-72 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
