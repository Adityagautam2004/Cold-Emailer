import { Skeleton, StatTileSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <Skeleton className="mb-8 h-8 w-56" />
      <StatTileSkeleton count={2} />
      <Skeleton className="mt-8 h-4 w-32" />
      <Skeleton className="mt-3 h-24 w-full" />
    </div>
  );
}
