import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder while an auth form reads its URL parameters. */
export function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
