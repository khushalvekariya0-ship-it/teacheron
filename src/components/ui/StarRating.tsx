import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Displays an authentic rating. When there are no reviews yet, says so instead of showing zero stars. */
export function StarRating({
  rating,
  count,
  size = "sm",
  showStars = true,
  className,
}: {
  rating: number | null;
  count?: number;
  size?: "sm" | "md" | "lg";
  showStars?: boolean;
  className?: string;
}) {
  const icon = { sm: "size-3.5", md: "size-4", lg: "size-5" }[size];
  const text = { sm: "text-[13px]", md: "text-sm", lg: "text-base" }[size];
  if (rating === null || !count) {
    return <span className={cn("inline-flex items-center gap-1 text-muted", text, className)}>New · no reviews yet</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", text, className)} aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${count} reviews`}>
      {showStars ? (
        <span className="flex items-center gap-px" aria-hidden>
          {[1, 2, 3, 4, 5].map((i) => {
            const fill = Math.max(0, Math.min(1, rating - (i - 1)));
            return (
              <span key={i} className={cn("relative", icon)}>
                <Star className={cn("absolute inset-0 fill-line text-line", icon)} />
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                  <Star className={cn("fill-star text-star", icon)} />
                </span>
              </span>
            );
          })}
        </span>
      ) : (
        <Star className={cn("fill-star text-star", icon)} aria-hidden />
      )}
      <span className="font-semibold tabular-nums text-ink">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="tabular-nums text-muted">({count})</span>}
    </span>
  );
}

/** Interactive star input for reviews. */
export function StarInput({ value, onChange, size = "lg" }: { value: number; onChange: (v: 1 | 2 | 3 | 4 | 5) => void; size?: "md" | "lg" }) {
  const [hover, setHover] = React.useState(0);
  const labels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Rating" className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {([1, 2, 3, 4, 5] as const).map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} star${i > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            className="rounded-md p-0.5 transition-transform hover:scale-110 active:scale-95"
          >
            <Star className={cn(size === "lg" ? "size-7" : "size-5", i <= shown ? "fill-star text-star" : "fill-sunken text-line-strong")} />
          </button>
        ))}
      </div>
      <span className="text-sm text-muted">{labels[shown]}</span>
    </div>
  );
}
