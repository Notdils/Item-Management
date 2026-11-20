import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">Memuat...</span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-20" />
    </div>
  );
}
