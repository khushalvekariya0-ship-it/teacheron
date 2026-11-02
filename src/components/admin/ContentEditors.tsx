"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, HelpCircle, MessageSquareQuote, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import type { BlogCategory, BlogPostItem, FaqAudience, FaqItem, TestimonialItem } from "@/lib/domain/data";
import { useApp } from "@/lib/store";
import { formatDate, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Checkbox, Segmented, Switch } from "@/components/ui/Controls";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { ConfirmDialog, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { ClearFilters, FilterSelect, SearchInput, Toolbar, matches } from "./kit";

/*
 * Admin → Content: the blog, FAQs and customer stories shown on the public site. Every change is
 * saved to the database through the content actions (content.manage permission) and written to the
 * audit log; public pages pick it up within a minute.
 */

const AUDIENCE_LABEL: Record<FaqAudience, string> = { families: "Families", tutors: "Tutors", payments: "Payments", safety: "Safety" };
const AUDIENCES = Object.keys(AUDIENCE_LABEL) as FaqAudience[];
const CATEGORIES: BlogCategory[] = ["Parents", "Students", "Tutors", "Test prep"];

/** Body text ⇄ blocks: paragraphs are separated by a blank line; a line starting with "## " is a heading. */
function bodyToText(body: BlogPostItem["body"]): string {
  return body.map((b) => `${b.h ? `## ${b.h}\n\n` : ""}${b.p}`.trim()).join("\n\n");
}
function textToBody(text: string): BlogPostItem["body"] {
  const out: BlogPostItem["body"] = [];
  let heading: string | undefined;
  for (const raw of text.split(/\n\s*\n/)) {
    const block = raw.trim();
    if (!block) continue;
    if (block.startsWith("## ")) {
      if (heading) out.push({ h: heading, p: "" });
      heading = block.slice(3).trim();
      continue;
    }
    out.push({ ...(heading ? { h: heading } : {}), p: block });
    heading = undefined;
  }
  if (heading) out.push({ h: heading, p: "" });
  return out;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Shared delete confirmation that waits for the server. */
function useDelete<T>(run: (item: T) => Promise<{ ok: boolean; error?: string }>, success: string) {
  const [target, setTarget] = React.useState<T | null>(null);
  const [busy, setBusy] = React.useState(false);
  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    const r = await run(target);
    setBusy(false);
    if (!r.ok) return void toast.error(r.error ?? "Couldn't delete it.");
    toast.success(success);
    setTarget(null);
  };
  return { target, setTarget, busy, confirm };
}

/* ─── Blog ───────────────────────────────────────────────────────────────────── */

export function BlogEditorTab({ publicLink }: { publicLink: (href: string) => React.ReactNode }) {
  const posts = useApp((s) => s.blogPosts);
  const remove = useApp((s) => s.deleteBlogPost);
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<"all" | BlogCategory>("all");
  const [editing, setEditing] = React.useState<BlogPostItem | "new" | null>(null);
  const del = useDelete<BlogPostItem>((p) => remove(p.slug), "Post deleted");
  const rows = posts.filter((p) => matches(q, p.title, p.excerpt, p.slug) && (category === "all" || p.category === category)).sort((a, b) => b.date.localeCompare(a.date));
  const filtered = q.trim() !== "" || category !== "all";

  const columns: Column<BlogPostItem>[] = [
    {
      key: "title",
      header: "Post",
      sortValue: (p) => p.title,
      cell: (p) => (
        <span className="block max-w-xl min-w-0">
          <span className="block font-medium text-ink">{p.title}</span>
          <span className="line-clamp-1 text-[12.5px] text-muted">{p.excerpt}</span>
        </span>
      ),
    },
    { key: "category", header: "Category", sortValue: (p) => p.category, cell: (p) => <Badge size="sm">{p.category}</Badge>, hideOnMobile: true },
    { key: "status", header: "Status", sortValue: (p) => p.status, cell: (p) => <Badge size="sm" tone={p.status === "published" ? "success" : "neutral"}>{p.status === "published" ? "Published" : "Draft"}</Badge> },
    { key: "date", header: "Date", sortValue: (p) => p.date, cell: (p) => <span className="whitespace-nowrap tabular-nums">{formatDate(`${p.date}T12:00:00Z`, "UTC")}</span>, hideOnMobile: true },
    { key: "link", header: "Public page", cell: (p) => (p.status === "published" ? publicLink(`/blog/${p.slug}`) : <span className="text-[12.5px] text-muted">Not public</span>), hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (p) => (
        <span className="inline-flex gap-1">
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${p.title}`} onClick={() => setEditing(p)}>
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${p.title}`} onClick={() => del.setTarget(p)}>
            <Trash2 />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <Toolbar summary={pluralize(rows.length, "post")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search posts…" label="Search blog posts" />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        <ClearFilters active={filtered} onClear={() => { setQ(""); setCategory("all"); }} />
        <Button size="sm" onClick={() => setEditing("new")} className="sm:ml-auto">
          <Plus /> New post
        </Button>
      </Toolbar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(p) => p.slug}
        pageSize={10}
        empty={<EmptyState icon={<Newspaper />} title={filtered ? "No posts match these filters" : "No blog posts yet"} description={filtered ? "Try another title or category, or clear the filters." : "Write your first article with New post."} />}
      />
      {editing && <BlogDialog post={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!del.target}
        onOpenChange={(o) => !o && del.setTarget(null)}
        title={del.target ? `Delete “${del.target.title}”?` : "Delete post?"}
        description="The article disappears from the blog straight away. This can't be undone — set it to Draft instead to hide it for now."
        confirmLabel="Delete post"
        tone="danger"
        loading={del.busy}
        onConfirm={() => void del.confirm()}
      />
    </>
  );
}

function BlogDialog({ post, onClose }: { post: BlogPostItem | null; onClose: () => void }) {
  const save = useApp((s) => s.saveBlogPost);
  const [title, setTitle] = React.useState(post?.title ?? "");
  const [excerpt, setExcerpt] = React.useState(post?.excerpt ?? "");
  const [category, setCategory] = React.useState<BlogCategory>(post?.category ?? "Parents");
  const [author, setAuthor] = React.useState(post?.author ?? "TutorLink Editorial");
  const [date, setDate] = React.useState(post?.date ?? today());
  const [status, setStatus] = React.useState<BlogPostItem["status"]>(post?.status ?? "draft");
  const [text, setText] = React.useState(post ? bodyToText(post.body) : "");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await save({ slug: post?.slug, title, excerpt, category, author, date, status, readMinutes: post?.readMinutes ?? 1, body: textToBody(text) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(post ? "Post saved" : status === "published" ? "Post published" : "Draft saved", { description: status === "published" ? "It shows on the blog within a minute." : undefined });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={post ? "Edit post" : "New post"} description="Separate paragraphs with a blank line. Start a line with “## ” for a heading." size="xl">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger" title={error} />}
            <Field label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
            </Field>
            <Field label="Summary" hint="Shown on the blog list and in search results.">
              <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} maxLength={400} showCount />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Category">
                <Select value={category} onChange={(e) => setCategory(e.target.value as BlogCategory)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label="Author">
                <Input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={80} />
              </Field>
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Article" required>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} />
            </Field>
            <Segmented
              size="sm"
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "draft", label: "Draft (hidden)" },
                { value: "published", label: "Published" },
              ]}
            />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              {status === "published" ? "Save and publish" : "Save draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── FAQs ───────────────────────────────────────────────────────────────────── */

export function FaqEditorTab({ publicLink }: { publicLink: (href: string) => React.ReactNode }) {
  const faqs = useApp((s) => s.faqs);
  const remove = useApp((s) => s.deleteFaq);
  const move = useApp((s) => s.moveFaq);
  const [q, setQ] = React.useState("");
  const [audience, setAudience] = React.useState<"all" | FaqAudience>("all");
  const [editing, setEditing] = React.useState<FaqItem | "new" | null>(null);
  const del = useDelete<FaqItem>((f) => remove(f.id), "Question deleted");
  const rows = faqs.filter((f) => matches(q, f.q, f.a) && (audience === "all" || f.audience === audience));
  const filtered = q.trim() !== "" || audience !== "all";
  const groups = AUDIENCES.map((a) => ({ audience: a, items: rows.filter((f) => f.audience === a) })).filter((g) => g.items.length);

  const reorder = async (f: FaqItem, direction: -1 | 1) => {
    const r = await move(f.id, direction);
    if (!r.ok) toast.error(r.error);
  };

  return (
    <>
      <Toolbar summary={pluralize(rows.length, "question")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search questions and answers…" label="Search FAQs" />
        <FilterSelect label="Audience" value={audience} onChange={setAudience} options={[{ value: "all", label: "All audiences" }, ...AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABEL[a] }))]} />
        <ClearFilters active={filtered} onClear={() => { setQ(""); setAudience("all"); }} />
        <Button size="sm" onClick={() => setEditing("new")} className="sm:ml-auto">
          <Plus /> New question
        </Button>
      </Toolbar>
      <p className="-mt-1 mb-4 flex flex-wrap items-center gap-2 text-[13px] text-muted">Public page: {publicLink("/faq")}</p>
      {groups.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState icon={<HelpCircle />} title={filtered ? "No questions match these filters" : "No FAQs yet"} description={filtered ? "Try other words, or clear the filters." : "Add your first question with New question."} />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.audience} aria-labelledby={`faq-${g.audience}`}>
              <h3 id={`faq-${g.audience}`} className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold text-ink">
                {AUDIENCE_LABEL[g.audience]}
                <span className="rounded-md bg-canvas px-1.5 py-px text-[11px] font-semibold tabular-nums text-ink-2">{g.items.length}</span>
              </h3>
              <Card>
                <ul className="divide-y divide-line">
                  {g.items.map((f, i) => (
                    <li key={f.id} className="flex gap-3 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-ink">
                          {f.q} {!f.published && <Badge size="sm">Hidden</Badge>}
                        </p>
                        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{f.a}</p>
                      </div>
                      <span className="flex shrink-0 items-start gap-0.5">
                        <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={filtered || i === 0} onClick={() => void reorder(f, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={filtered || i === g.items.length - 1} onClick={() => void reorder(f, 1)}>
                          <ArrowDown />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Edit “${f.q}”`} onClick={() => setEditing(f)}>
                          <Pencil />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Delete “${f.q}”`} onClick={() => del.setTarget(f)}>
                          <Trash2 />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
      {editing && <FaqDialog faq={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!del.target}
        onOpenChange={(o) => !o && del.setTarget(null)}
        title="Delete this question?"
        description="It's removed from the FAQ page straight away. Turn off “Show on the site” instead to hide it for now."
        confirmLabel="Delete question"
        tone="danger"
        loading={del.busy}
        onConfirm={() => void del.confirm()}
      />
    </>
  );
}

function FaqDialog({ faq, onClose }: { faq: FaqItem | null; onClose: () => void }) {
  const save = useApp((s) => s.saveFaq);
  const [audience, setAudience] = React.useState<FaqAudience>(faq?.audience ?? "families");
  const [question, setQuestion] = React.useState(faq?.q ?? "");
  const [answer, setAnswer] = React.useState(faq?.a ?? "");
  const [published, setPublished] = React.useState(faq?.published ?? true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await save({ id: faq?.id, audience, q: question, a: answer, published });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(faq ? "Question saved" : "Question added");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={faq ? "Edit question" : "New question"} size="lg">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger" title={error} />}
            <Field label="Audience">
              <Select value={audience} onChange={(e) => setAudience(e.target.value as FaqAudience)} options={AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABEL[a] }))} />
            </Field>
            <Field label="Question" required>
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />
            </Field>
            <Field label="Answer" required>
              <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={6} maxLength={2000} showCount />
            </Field>
            <label className="flex items-center justify-between gap-3 text-[14px] text-ink">
              Show on the site
              <Switch checked={published} onCheckedChange={setPublished} />
            </label>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              Save question
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Testimonials ───────────────────────────────────────────────────────────── */

export function TestimonialsEditorTab() {
  const items = useApp((s) => s.testimonials);
  const remove = useApp((s) => s.deleteTestimonial);
  const [editing, setEditing] = React.useState<TestimonialItem | "new" | null>(null);
  const del = useDelete<TestimonialItem>((t) => remove(t.id), "Story deleted");
  return (
    <>
      <InlineAlert tone="info" title="Only real stories, with permission" className="mb-5">
        Publish a story only when the customer has agreed in writing to it being shown, and has approved the exact wording. The site shows nothing here until you publish one.
      </InlineAlert>
      <Toolbar summary={pluralize(items.length, "story", "stories")}>
        <Button size="sm" onClick={() => setEditing("new")} className="sm:ml-auto">
          <Plus /> New story
        </Button>
      </Toolbar>
      {items.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState icon={<MessageSquareQuote />} title="No customer stories yet" description="The home page hides its stories section until you publish one." />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => (
            <li key={t.id}>
              <Card className="flex h-full flex-col p-5">
                <Badge tone={t.published ? "success" : "neutral"} size="sm" className="self-start">
                  {t.published ? "Published" : "Not published"}
                </Badge>
                <blockquote className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-2">“{t.quote}”</blockquote>
                <p className="mt-4 text-[13px] font-medium text-ink">{t.name}</p>
                <p className="text-[12.5px] text-muted">{t.context}</p>
                <div className="mt-4 flex gap-2 border-t border-line pt-3">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>
                    <Pencil /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => del.setTarget(t)}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {editing && <TestimonialDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!del.target}
        onOpenChange={(o) => !o && del.setTarget(null)}
        title="Delete this story?"
        description="It's removed from the home page straight away."
        confirmLabel="Delete story"
        tone="danger"
        loading={del.busy}
        onConfirm={() => void del.confirm()}
      />
    </>
  );
}

function TestimonialDialog({ item, onClose }: { item: TestimonialItem | null; onClose: () => void }) {
  const save = useApp((s) => s.saveTestimonial);
  const [quote, setQuote] = React.useState(item?.quote ?? "");
  const [name, setName] = React.useState(item?.name ?? "");
  const [context, setContext] = React.useState(item?.context ?? "");
  const [label, setLabel] = React.useState(item?.used.label ?? "");
  const [href, setHref] = React.useState(item?.used.href ?? "");
  const [consent, setConsent] = React.useState(item?.consentConfirmed ?? false);
  const [published, setPublished] = React.useState(item?.published ?? false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await save({ id: item?.id, quote, name, context, used: { label, href }, consentConfirmed: consent, published: published && consent });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(item ? "Story saved" : "Story added");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={item ? "Edit story" : "New customer story"} size="lg">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger" title={error} />}
            <Field label="What they said" required>
              <Textarea value={quote} onChange={(e) => setQuote(e.target.value)} rows={4} maxLength={400} showCount />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Who said it" required hint="e.g. Parent of a 7th grader">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </Field>
              <Field label="Where and what" hint="e.g. Brooklyn, NY · Pre-algebra">
                <Input value={context} onChange={(e) => setContext(e.target.value)} maxLength={120} />
              </Field>
              <Field label="Link text" optional hint="e.g. Compare tutors">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
              </Field>
              <Field label="Link to page" optional hint="A page on this site, e.g. /tutors">
                <Input value={href} onChange={(e) => setHref(e.target.value)} maxLength={120} placeholder="/tutors" />
              </Field>
            </div>
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} label="This customer agreed in writing to this story being shown, with this wording." />
            <label className="flex items-center justify-between gap-3 text-[14px] text-ink">
              Show on the home page
              <Switch checked={published && consent} disabled={!consent} onCheckedChange={setPublished} />
            </label>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              Save story
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
