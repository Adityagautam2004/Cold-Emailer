import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="max-w-2xl">
      <Skeleton className="mb-8 h-8 w-32" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-40 w-full" />
    </div>
  );
}
