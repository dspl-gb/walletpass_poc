"use client";

export function OfflineRetryButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="mt-2 rounded-lg bg-[#1c1612] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2d231c]"
    >
      Try again
    </button>
  );
}
