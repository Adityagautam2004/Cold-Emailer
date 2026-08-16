import { Skeleton, StatTileSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function CampaignDetailLoading() {
  return (
    <div>
      <Skeleton className="mb-2 h-4 w-32" />
      <div className="mb-8 flex items-center justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-9 w-40" />
      </div>
      <StatTileSkeleton count={5} />
      <Skeleton className="mt-8 h-32 w-full" />
      <TableSkeleton cols={5} />
    </div>
  );
}
