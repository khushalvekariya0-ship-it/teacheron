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
    <div className="container-page pb-24 pt-6 lg:pt-10" role="status" aria-label="Loading tutors">
      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10 xl:gap-14">
        <div className="hidden space-y-5 lg:block">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2 border-t border-line pt-4">
              <Skeleton className="h-4 w-36" />
              {i < 2 && <Skeleton className="h-10 w-full" />}
            </div>
          ))}
        </div>
        <div>
          <Skeleton className="mb-5 h-9 w-full lg:hidden" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <TutorRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
