"use client";

import * as React from "react";
import { Wallet } from "lucide-react";
import { useSession, useWalletBalance } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";
import { WalletDrawer, formatCredits } from "./WalletDrawer";

/** Navbar pill with the Study Credits balance; opens the wallet drawer. Only students and parents have a wallet. */
export function WalletButton({ className }: { className?: string }) {
  const me = useSession();
  const balance = useWalletBalance();
  const [open, setOpen] = React.useState(false);
  if (!me || (me.role !== "student" && me.role !== "parent")) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Study wallet: ${formatCredits(balance)}`}
        className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line-strong pl-3 pr-3.5 text-[14px] font-semibold tabular-nums text-ink transition-colors hover:bg-sunken", className)}
      >
        <Wallet className="size-[18px] text-brand" aria-hidden /> {formatCredits(balance)}
      </button>
      <WalletDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
