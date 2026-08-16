import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function ListsLoading() {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <TableSkeleton cols={4} />
    </div>
  );
}
