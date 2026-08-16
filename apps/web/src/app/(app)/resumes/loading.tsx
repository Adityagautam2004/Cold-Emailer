import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function ResumesLoading() {
  return (
    <div>
      <Skeleton className="mb-2 h-8 w-32" />
      <Skeleton className="mb-6 h-4 w-96" />
      <Skeleton className="mb-6 h-9 w-40" />
      <TableSkeleton cols={5} />
    </div>
  );
}
