import { Skeleton } from "@/components/ui/Skeleton";

export function TutorRowSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex gap-4 sm:gap-5">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2.5 pt-1">
          <div className="flex justify-between gap-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="mt-4 h-10 w-full" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Suspense fallback for /tutors while search params resolve on the client. */
export function DirectorySkeleton() {
  return (
    <div className="container-page pb-24 pt-8 sm:pt-10" role="status" aria-label="Loading tutors">
      <Skeleton className="h-10 w-full max-w-2xl sm:h-12" />
      <Skeleton className="mt-4 h-4 w-full max-w-xl" />
      <div className="mt-8 hidden grid-cols-4 gap-3 lg:grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[62px] rounded-xl" />
        ))}
      </div>
      <div className="mt-3 hidden gap-2 lg:flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-6 h-9 w-full lg:hidden" />
      <Skeleton className="mt-8 h-7 w-64" />
      <div className="mt-6 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-8">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <TutorRowSkeleton key={i} />
          ))}
        </div>
        <Skeleton className="hidden h-[380px] rounded-2xl xl:block" />
      </div>
    </div>
  );
}
