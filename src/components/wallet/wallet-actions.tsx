"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppleWalletButton } from "@/components/wallet/apple-wallet-button";
import { GoogleWalletButton } from "@/components/wallet/google-wallet-button";
import { detectPlatform, type PlatformHint } from "@/lib/platform";
import type { WalletBlockReason } from "@/lib/wallet/common/pass";
import type { WalletConfigStatus } from "@/lib/wallet/common/types";

type Busy = "apple" | "google" | null;

interface WalletActionsProps {
  passId: string;
  blockReason?: WalletBlockReason;
  status?: WalletConfigStatus;
  platformHint?: PlatformHint;
}

interface ApiErrorBody {
  error?: { message?: string };
  mock?: boolean;
  reason?: string;
  message?: string;
  saveUrl?: string;
}

const BLOCK_MESSAGES: Record<Exclude<WalletBlockReason, null>, { title: string; description: string }> = {
  draft: {
    title: "Pass not published yet",
    description: "Publish this pass before adding it to Apple Wallet or Google Wallet.",
  },
  expired: {
    title: "This pass has expired",
    description: "Expired passes cannot be added to Apple Wallet or Google Wallet.",
  },
  archived: {
    title: "This pass has been archived",
    description: "Archived passes cannot be added to Apple Wallet or Google Wallet.",
  },
};

export function WalletActions({ passId, blockReason = null, status, platformHint }: WalletActionsProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  const hint = useMemo(
    () => platformHint ?? detectPlatform(typeof navigator === "undefined" ? "" : navigator.userAgent),
    [platformHint],
  );

  const appleFirst = hint.primaryWallet === "apple";
  const walletBlocked = blockReason !== null;

  async function addToApple() {
    setError(null);
    setNotice(null);
    setBusy("apple");
    try {
      const response = await fetch("/api/wallet/apple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passId }),
      });
      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("application/vnd.apple.pkpass")) {
        const signed = response.headers.get("x-wallet-signed") !== "false";
        const disposition = response.headers.get("content-disposition") ?? "";
        const fileNameMatch = disposition.match(/filename="([^"]+)"/);
        const fileName = fileNameMatch?.[1] ?? "membership.pkpass";

        if (hint.isAppleDevice && signed) {
          window.location.assign(`/api/wallet/apple?passId=${encodeURIComponent(passId)}`);
          return;
        }

        const blob = await response.blob();
        const file = new Blob([blob], { type: "application/vnd.apple.pkpass" });
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);

        if (!signed) {
          setNotice({
            title: "Unsigned .pkpass downloaded",
            message:
              "This file is built from the pass data. Apple Wallet will not install it until Pass Type certificates are configured.",
          });
        }
        return;
      }

      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Could not generate the Apple Wallet pass.");
      }
      if (body.mock) {
        setNotice({
          title: "Mock mode — not added to Apple Wallet",
          message:
            body.message ??
            "Mock mode is on. No Apple Wallet pass was generated, and nothing was added to a wallet.",
        });
        return;
      }
      throw new Error("Unexpected response from the Apple Wallet endpoint.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate the Apple Wallet pass.");
    } finally {
      setBusy(null);
    }
  }

  async function addToGoogle() {
    setError(null);
    setNotice(null);
    setBusy("google");
    try {
      const response = await fetch("/api/wallet/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passId }),
      });
      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Could not create the Google Wallet save link.");
      }
      if (!body.saveUrl) {
        throw new Error("The server did not return a Google Wallet save link.");
      }
      window.location.assign(body.saveUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the Google Wallet save link.");
      setBusy(null);
    }
  }

  const appleDisabled = walletBlocked;
  const googleDisabled = walletBlocked || (status && !status.mockMode && !status.googleConfigured);

  const buttons = [
    {
      key: "apple" as const,
      node: (
        <AppleWalletButton
          onClick={addToApple}
          pending={busy === "apple"}
          disabled={appleDisabled || busy !== null}
        />
      ),
    },
    {
      key: "google" as const,
      node: (
        <GoogleWalletButton
          onClick={addToGoogle}
          pending={busy === "google"}
          disabled={googleDisabled || busy !== null}
        />
      ),
    },
  ];

  const ordered = appleFirst ? buttons : [...buttons].reverse();
  const blockMessage = blockReason ? BLOCK_MESSAGES[blockReason] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {ordered.map((item) => (
          <div key={item.key}>{item.node}</div>
        ))}
      </div>
      {blockMessage ? (
        <Alert variant={blockReason === "draft" ? "warning" : "destructive"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{blockMessage.title}</AlertTitle>
          <AlertDescription>{blockMessage.description}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not start the wallet flow</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
