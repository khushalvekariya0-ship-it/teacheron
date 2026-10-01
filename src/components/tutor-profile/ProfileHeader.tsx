"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronRight, Clock3, GitCompareArrows, Heart, Languages, Link2, MapPin, Monitor, Users, Zap, BookOpenCheck } from "lucide-react";
import type { Tutor } from "@/lib/types";
import { TUTOR_CATEGORY_LABEL } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";
import { motion } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { toast } from "@/components/ui/Toast";
import { VerifiedBadge } from "@/components/domain/Badges";
import { useTutorActions } from "@/components/domain/useTutorActions";

export function modeSummary(t: Pick<Tutor, "modes">): string {
  const online = t.modes.includes("online");
  const inPerson = t.modes.includes("in_person");
  return online && inPerson ? "Online & in person" : online ? "Online only" : "In person only";
}

const fade = (delay: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const } });

export function ProfileHeader({ tutor, instant }: { tutor: Tutor; instant: boolean }) {
  const actions = useTutorActions(tutor);
  const name = `${tutor.firstName} ${tutor.lastName}`;
  const verified = tutor.verification.identity === "verified";

  const share = async () => {
    const url = `${window.location.origin}/tutors/${tutor.slug}`;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: `${name} — ${tutor.headline}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: "Share it with anyone helping you choose." });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      toast.error("Couldn't copy the link", { description: url });
    }
  };

  return (
    <header>
      <motion.nav {...fade(0)} aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-[13px] text-muted">
        <Link href="/tutors" className="hover:text-ink">
          Tutors
        </Link>
        <ChevronRight className="size-3.5 text-subtle" aria-hidden />
        <span aria-current="page" className="truncate text-ink-2">
          {name}
        </span>
      </motion.nav>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <Avatar name={name} tone={tutor.tone} size="3xl" square verified={verified} className="[&>span:first-child]:size-28 sm:[&>span:first-child]:size-40" />
        </motion.div>

        <div className="min-w-0 flex-1">
          <motion.div {...fade(0.05)} className="flex flex-wrap items-center gap-2">
            <VerifiedBadge tutor={tutor} />
            {instant && (
              <Badge tone="neutral">
                <Zap /> Instant booking
              </Badge>
            )}
            <Badge tone="outline">{TUTOR_CATEGORY_LABEL[tutor.category]}</Badge>
          </motion.div>
          <motion.h1 {...fade(0.1)} className="mt-3 font-heading text-[2.4rem] font-bold leading-[1] tracking-[-0.025em] text-ink sm:text-5xl lg:text-[3.4rem]">
            {name}
          </motion.h1>
          <motion.p {...fade(0.16)} className="mt-2 text-lg leading-snug text-ink-2 sm:text-xl">
            {tutor.headline}
          </motion.p>

          <motion.ul {...fade(0.22)} className="mt-5 flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-muted">
            <li>
              <a href="#reviews" className="rounded-sm hover:text-ink">
                <StarRating rating={tutor.rating} count={tutor.reviewCount} size="md" />
              </a>
            </li>
            <li className="flex items-center gap-1.5">
              <MapPin className="size-4 text-subtle" aria-hidden /> {tutor.city}, {tutor.state}
            </li>
            <li className="flex items-center gap-1.5">
              {tutor.modes.includes("online") ? <Monitor className="size-4 text-subtle" aria-hidden /> : <Users className="size-4 text-subtle" aria-hidden />}
              {modeSummary(tutor)}
            </li>
            {tutor.lessonsCompleted > 0 && (
              <li className="flex items-center gap-1.5">
                <BookOpenCheck className="size-4 text-subtle" aria-hidden />
                <span className="tabular-nums">{tutor.lessonsCompleted.toLocaleString("en-US")}</span> lessons completed
              </li>
            )}
            {tutor.responseTimeHours != null && (
              <li className="flex items-center gap-1.5">
                <Clock3 className="size-4 text-subtle" aria-hidden /> Usually responds within {tutor.responseTimeHours} {tutor.responseTimeHours === 1 ? "hour" : "hours"}
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <Languages className="size-4 text-subtle" aria-hidden /> {tutor.languages.join(", ")}
            </li>
          </motion.ul>

          <motion.div {...fade(0.28)} className="mt-6 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={actions.toggleSave} aria-pressed={actions.saved}>
              <motion.span key={String(actions.saved)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5, duration: 0.4 }} className="inline-flex">
                <Heart className={cn(actions.saved && "fill-ink text-ink")} />
              </motion.span>
              {actions.saved ? "Saved" : "Save"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={actions.toggleCompare}
              aria-pressed={actions.comparing}
              disabled={actions.compareFull}
              title={actions.compareFull ? "You can compare up to 3 tutors" : undefined}
              className={cn(actions.comparing && "border-navy bg-navy-50 text-navy hover:bg-navy-50")}
            >
              {actions.comparing ? <Check /> : <GitCompareArrows />}
              {actions.comparing ? "Comparing" : "Compare"}
            </Button>
            <Button variant="secondary" size="sm" onClick={share}>
              <Link2 /> Share
            </Button>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
