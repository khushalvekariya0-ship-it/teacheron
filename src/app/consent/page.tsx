import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsentView } from "./ConsentView";

export const metadata: Metadata = {
  title: "Approve your student's account",
  robots: { index: false, follow: false },
};

export default function ConsentPage() {
  return (
    <Suspense fallback={null}>
      <ConsentView />
    </Suspense>
  );
}
