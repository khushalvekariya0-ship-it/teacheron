import { Skeleton } from "@/components/ui/Skeleton";

/** Loading frame for the messages page (matches the two-pane layout). */
export function MessagesSkeleton() {
  return (
    <div className="-mx-4 -my-6 h-[calc(100dvh-4rem)] sm:-mx-6 md:mx-0 md:my-0 md:h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-8rem)]" role="status" aria-label="Loading messages">
      <div className="grid h-full overflow-hidden bg-surface md:grid-cols-[300px_minmax(0,1fr)] md:rounded-2xl md:border md:border-line xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-3 p-4 md:border-r md:border-line">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-2">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden flex-col md:flex">
          <div className="flex items-center gap-3 border-b border-line p-4">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex-1 space-y-3 p-6">
            <Skeleton className="h-10 w-2/3 rounded-2xl" />
            <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
            <Skeleton className="h-16 w-3/5 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
