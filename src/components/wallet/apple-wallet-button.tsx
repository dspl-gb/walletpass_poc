"use client";

import { cn } from "@/lib/utils";

export function AppleWalletButton({
  onClick,
  disabled,
  pending,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      aria-label="Add to Apple Wallet"
      className={cn(
        "inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-[10px] bg-black px-5 text-white shadow-sm transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[240px]",
        className,
      )}
    >
      <AppleMark className="h-5 w-5" />
      <span className="text-[15px] font-medium tracking-tight">
        {pending ? "Preparing pass…" : "Add to Apple Wallet"}
      </span>
    </button>
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.7 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-0.8-3-0.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-.1 2.9-2.2c.7-1.1 1-2.2 1-2.2s-2.3-.9-2.3-3.3zm-2.1-6.2c.6-.8 1.1-1.8.9-2.9-0.9 0-2 .6-2.6 1.4-.6.7-1.1 1.8-.9 2.8 1 .1 2-.5 2.6-1.3z"
      />
    </svg>
  );
}
