"use client";

import { cn } from "@/lib/utils";

export function GoogleWalletButton({
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
      aria-label="Add to Google Wallet"
      className={cn(
        "inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-black px-4 text-white shadow-sm transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[240px] hidden",
        className,
      )}
    >
      <GoogleWalletMark />
      <span className="text-[15px] font-medium tracking-tight">
        {pending ? "Preparing pass…" : "Add to Google Wallet"}
      </span>
    </button>
  );
}

function GoogleWalletMark() {
  return (
    <svg width="28" height="20" viewBox="0 0 48 34" aria-hidden="true">
      <rect x="1" y="6" width="34" height="22" rx="4" fill="#fff" />
      <rect x="4" y="9" width="28" height="6" rx="1.5" fill="#4285F4" />
      <circle cx="38" cy="17" r="9" fill="#34A853" />
      <path d="M34.8 17.1h6.4M38 13.9v6.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
