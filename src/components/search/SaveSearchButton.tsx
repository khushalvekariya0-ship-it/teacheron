"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellPlus } from "lucide-react";
import type { AlertFrequency } from "@/lib/types";
import { describeSearch, toQueryString, toRecord, type TutorSearch } from "@/lib/search";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/store/hooks";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { RadioCards } from "@/components/ui/Controls";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const FREQUENCIES: { value: AlertFrequency; label: string; description: string }[] = [
  { value: "instant", label: "Instantly", description: "As soon as a new tutor matches" },
  { value: "daily", label: "Daily digest", description: "One summary a day, only when there's news" },
  { value: "weekly", label: "Weekly digest", description: "One summary a week" },
  { value: "off", label: "No alerts", description: "Just keep the search saved" },
];

export function SaveSearchButton({ params, className, compact }: { params: TutorSearch; className?: string; compact?: boolean }) {
  const router = useRouter();
  const me = useSession();
  const saveSearch = useApp((s) => s.saveSearch);
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [frequency, setFrequency] = React.useState<AlertFrequency>("daily");
  const [error, setError] = React.useState<string | undefined>();
  const [saving, setSaving] = React.useState(false);

  const start = () => {
    const qs = toQueryString(params);
    if (!me) {
      toast("Sign in to save searches", { description: "We'll bring you right back to these results." });
      router.push(`/login?next=${encodeURIComponent(`/tutors${qs ? `?${qs}` : ""}`)}`);
      return;
    }
    setLabel(describeSearch(params));
    setFrequency("daily");
    setError(undefined);
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = label.trim();
    if (name.length < 3) return setError("Give this search a name of at least 3 characters.");
    if (name.length > 80) return setError("Keep the name under 80 characters.");
    setSaving(true);
    const res = saveSearch({ kind: "tutors", label: name, query: toRecord(params), frequency });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setOpen(false);
    toast.success("Search saved", {
      description: frequency === "off" ? "Find it any time under Saved searches." : `We'll alert you ${frequency === "instant" ? "as soon as" : frequency === "daily" ? "daily when" : "weekly when"} new tutors match.`,
      action: { label: "View saved searches", onClick: () => router.push("/dashboard/saved-searches") },
    });
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={start} className={cn(className)} aria-label={compact ? "Save search" : undefined}>
        <BellPlus /> {compact ? <span className="sr-only sm:not-sr-only">Save</span> : "Save search"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Save this search" description="Get alerted when new tutors match these filters." size="md">
          <form onSubmit={submit} noValidate>
            <DialogBody className="space-y-5">
              <Field label="Name" required error={error}>
                <Input
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (error) setError(undefined);
                  }}
                  maxLength={80}
                  autoFocus
                />
              </Field>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink">Alert frequency</legend>
                <RadioCards name="frequency" value={frequency} onValueChange={setFrequency} options={FREQUENCIES} />
              </fieldset>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save search
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
