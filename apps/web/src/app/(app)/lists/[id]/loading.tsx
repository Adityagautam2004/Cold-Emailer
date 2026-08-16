import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function ListDetailLoading() {
  return (
    <div>
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-8 h-8 w-56" />
      <TableSkeleton cols={6} rows={8} />
    </div>
  );
}
