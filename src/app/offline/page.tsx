import type { Metadata } from "next";

import { OfflineRetryButton } from "./retry-button";

export const metadata: Metadata = {
  title: "Offline",
  description: "You are currently offline.",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#1c1612] text-4xl text-[#e8c98a]">
        ✕
      </div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        You&apos;re offline
      </h1>
      <p className="max-w-sm text-muted-foreground">
        It looks like you&apos;ve lost your internet connection. Please check
        your network settings and try again.
      </p>
      <OfflineRetryButton />
    </div>
  );
}
