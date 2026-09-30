"use client";

import * as React from "react";
import Link from "next/link";
import { GitCompareArrows, Heart, Search } from "lucide-react";
import type { Tutor, User } from "@/lib/types";
import { PageHeader, RoleGate } from "@/components/dashboard/Shell";
import { AnimatePresence, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { TutorCard } from "@/components/domain/TutorCard";
import { useApp } from "@/lib/store";
import { useSession, useTutors } from "@/lib/store/hooks";
import { pluralize } from "@/lib/format";

export function FavoritesView() {
  return (
    <RoleGate roles={["student", "parent"]}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const me = useSession() as User;
  const saved = useApp((s) => s.favorites[me.id]);
  const compare = useApp((s) => s.compare);
  const tutors = useTutors();

  // Most recently saved first.
  const list = React.useMemo(() => {
    const byId = new Map(tutors.map((t) => [t.id, t]));
    return [...(saved ?? [])].reverse().map((id) => byId.get(id)).filter((t): t is Tutor => !!t);
  }, [saved, tutors]);

  return (
    <div>
      <PageHeader
        title="Favorites"
        description={list.length ? `${pluralize(list.length, "saved tutor")}. Select up to three to compare side by side.` : "Tutors you save appear here so you can come back to them."}
        actions={
          <>
            {compare.length >= 2 && (
              <Button asChild variant="secondary">
                <Link href="/compare">
                  <GitCompareArrows /> Compare {compare.length}
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/tutors">
                <Search /> Find tutors
              </Link>
            </Button>
          </>
        }
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Heart />}
            title="No favorites yet"
            description="Tap the heart on any tutor's card or profile to save them here."
            action={
              <Button asChild>
                <Link href="/tutors">
                  <Search /> Browse tutors
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <motion.ul layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false} mode="popLayout">
            {list.map((t, i) => (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 8) * 0.05 } }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                className="h-full"
              >
                <TutorCard tutor={t} layout="grid" />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}
