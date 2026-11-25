import * as React from "react";
import { Blocks, BookOpen, Brain, BriefcaseBusiness, Calculator, Code, Cog, FlaskConical, Landmark, Languages, Music, PenLine, Stethoscope, Target, type LucideIcon } from "lucide-react";

/** Same category marks as the homepage subject grid. */
const CATEGORY_ICON: Record<string, LucideIcon> = {
  math: Calculator,
  science: FlaskConical,
  english: PenLine,
  "test-prep": Target,
  languages: Languages,
  "computer-science": Code,
  "social-studies": Landmark,
  arts: Music,
  "learning-support": Brain,
  business: BriefcaseBusiness,
  engineering: Cog,
  health: Stethoscope,
  "early-years": Blocks,
};

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  return React.createElement(CATEGORY_ICON[slug] ?? BookOpen, { className, "aria-hidden": true });
}
