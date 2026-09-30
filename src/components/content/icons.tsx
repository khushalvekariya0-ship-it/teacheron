import * as React from "react";
import { BookOpen, Brain, Calculator, Code, FlaskConical, Landmark, Languages, Music, PenLine, Target, type LucideIcon } from "lucide-react";

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
};

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  return React.createElement(CATEGORY_ICON[slug] ?? BookOpen, { className, "aria-hidden": true });
}
