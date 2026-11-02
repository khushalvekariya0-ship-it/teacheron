"use client";

import type * as React from "react";
import { fileUrl } from "@/lib/upload";
import { cn } from "@/lib/utils";

/**
 * An uploaded file's name that opens the file. Private files open through /api/files, which checks
 * the viewer may see it and redirects to a short-lived signed link. Files without a stored copy
 * render as plain text.
 */
export function FileLink({ path, className, children }: { path?: string; className?: string; children: React.ReactNode }) {
  const href = fileUrl(path);
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(className, "underline-offset-2 hover:underline")}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
