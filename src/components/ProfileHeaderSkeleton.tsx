import { Skeleton } from "@/components/ui/skeleton";

export function ProfileHeaderSkeleton() {
  return (
    <>
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="px-4 pb-4">
        <div className="flex items-end justify-between gap-3">
          <Skeleton className="-mt-10 size-20 shrink-0 rounded-full border-4 border-background" />
        </div>
        <Skeleton className="mt-3 h-6 w-40" />
        <Skeleton className="mt-2 h-3.5 w-24" />
        <Skeleton className="mt-3 h-3.5 w-full max-w-sm" />
      </div>
    </>
  );
}
