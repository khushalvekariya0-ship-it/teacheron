"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Users, BookOpen, ShieldCheck, Headset } from "lucide-react";
import { useApp } from "@/lib/store";
import { toast } from "@/components/ui/Toast";
import { homeFor } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export const DEMO_ACCOUNTS: { id: string; role: Role; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "usr_student", role: "student", label: "Student", description: "Jordan Lee · 12th grade, Chicago", icon: GraduationCap },
  { id: "usr_parent", role: "parent", label: "Parent", description: "Dana Whitaker · 2 children, Brooklyn", icon: Users },
  { id: "usr_tutor", role: "tutor", label: "Tutor", description: "Sarah Chen · Math, New York", icon: BookOpen },
  { id: "usr_admin", role: "admin", label: "Administrator", description: "Morgan Hayes · full access", icon: ShieldCheck },
  { id: "usr_support", role: "support", label: "Support staff", description: "Sam Ortiz · limited permissions", icon: Headset },
];

/** Signs in as a demo account and routes to its dashboard. Preview build only. */
export function useDemoLogin() {
  const router = useRouter();
  const loginAs = useApp((s) => s.loginAs);
  return React.useCallback(
    (userId: string, next?: string) => {
      const res = loginAs(userId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Signed in as ${res.data.firstName} ${res.data.lastName}`, { description: "Demo account — sample data only." });
      router.push(next ?? homeFor(res.data.role));
    },
    [loginAs, router],
  );
}
