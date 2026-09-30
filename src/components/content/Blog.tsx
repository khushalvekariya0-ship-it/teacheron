import Link from "next/link";
import { ArrowUpRight, BookOpenText, GraduationCap, NotebookPen, Target } from "lucide-react";
import type { BlogPost } from "@/lib/data/content";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/* Typographic post covers — no stock photography. Each category gets its own texture and mark. */

const CATEGORY_STYLE: Record<BlogPost["category"], { icon: typeof BookOpenText; texture: string }> = {
  Parents: { icon: BookOpenText, texture: "bg-dot-grid" },
  Students: { icon: NotebookPen, texture: "bg-line-grid" },
  Tutors: { icon: GraduationCap, texture: "bg-dot-grid" },
  "Test prep": { icon: Target, texture: "bg-line-grid" },
};

export function postDate(iso: string): string {
  return formatDate(`${iso}T12:00:00Z`, "UTC", { month: "long", day: "numeric", year: "numeric" });
}

export function PostCover({ post, size = "md", className }: { post: BlogPost; size?: "md" | "lg"; className?: string }) {
  const style = CATEGORY_STYLE[post.category];
  const Icon = style.icon;
  return (
    <div className={cn("relative overflow-hidden border-b border-line bg-canvas", size === "lg" ? "aspect-[16/10] lg:aspect-auto lg:h-full lg:border-b-0 lg:border-r" : "aspect-[16/9]", className)} aria-hidden>
      <div className={cn("absolute inset-0 opacity-90 mask-radial transition-transform duration-700 ease-out group-hover:scale-[1.04]", style.texture)} />
      <div className="absolute inset-0 grid place-items-center">
        <span className={cn("grid place-items-center rounded-2xl border border-line bg-surface text-navy shadow-sm transition-transform duration-500 group-hover:-translate-y-1", size === "lg" ? "size-20" : "size-14")}>
          <Icon className={size === "lg" ? "size-8" : "size-6"} strokeWidth={1.5} />
        </span>
      </div>
      <span className="absolute left-4 top-4 rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[11.5px] font-medium text-ink-2">{post.category}</span>
    </div>
  );
}

export function PostMeta({ post, className }: { post: BlogPost; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 text-[13px] text-muted", className)}>
      <time dateTime={post.date}>{postDate(post.date)}</time>
      <span aria-hidden>·</span>
      <span>{post.readMinutes} min read</span>
    </p>
  );
}

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <article data-spotlight className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy has-[:focus-visible]:ring-offset-2">
      <PostCover post={post} />
      <div className="flex flex-1 flex-col p-5">
        <PostMeta post={post} />
        <h3 className="mt-2 text-[17px] font-semibold leading-snug tracking-tight text-ink">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {post.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{post.excerpt}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-medium text-navy">
          Read article <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </article>
  );
}

export function FeaturedPost({ post }: { post: BlogPost }) {
  return (
    <article data-spotlight className="group relative grid overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy has-[:focus-visible]:ring-offset-2 lg:grid-cols-[1.1fr_1fr]">
      <PostCover post={post} size="lg" />
      <div className="flex flex-col justify-center p-6 sm:p-10">
        <p className="eyebrow">Featured</p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-3xl">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {post.title}
          </Link>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{post.excerpt}</p>
        <PostMeta post={post} className="mt-6" />
        <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-navy">
          Read article <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </article>
  );
}
