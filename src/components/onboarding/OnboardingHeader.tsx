"use client";

import Link from "next/link";
import { LogOut, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useSaveExitHandler } from "./saveExit";

/** Focused header for onboarding: logo and a way out. "Save & exit" appears while a wizard is active. */
export function OnboardingHeader() {
  const saveAndExit = useSaveExitHandler();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        {saveAndExit ? (
          <Button variant="ghost" size="sm" onClick={saveAndExit}>
            <LogOut /> Save &amp; exit
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <X /> Exit
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
