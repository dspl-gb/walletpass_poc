import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PassPreview } from "@/components/wallet/pass-preview";
import { PublishPassButton } from "@/components/wallet/publish-pass-button";
import { StatusBanner } from "@/components/wallet/status-banner";
import { WalletActions } from "@/components/wallet/wallet-actions";
import { getWalletConfigStatus } from "@/lib/config/env";
import { listEventsForPass } from "@/lib/db/events";
import { assertPassOwnership, getPassById, isUsingMemoryStore } from "@/lib/db/passes";
import { detectPlatform } from "@/lib/platform";
import { getOwnerId } from "@/lib/session";
import { formatExpirationDate, getWalletBlockReason, isPassUsable } from "@/lib/wallet/common/pass";
import { passTypeLabel } from "@/lib/wallet/common/schema";

export const dynamic = "force-dynamic";

export default async function PassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pass = await getPassById(id);
  if (!pass) notFound();

  const ownerId = await getOwnerId();
  try {
    assertPassOwnership(pass, ownerId);
  } catch {
    notFound();
  }

  const headerList = await headers();
  const platformHint = detectPlatform(headerList.get("user-agent"));
  const status = getWalletConfigStatus();
  const events = await listEventsForPass(pass.id, 8);
  const usable = isPassUsable(pass);
  const blockReason = getWalletBlockReason(pass);

  return (
    <div className="container space-y-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {passTypeLabel(pass.passType)}
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{pass.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={usable ? "gold" : "outline"}>{pass.status}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={`/passes/${pass.id}/edit`}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <StatusBanner status={status} memoryStore={isUsingMemoryStore()} />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <PassPreview pass={pass} />
          {pass.status === "draft" ? <PublishPassButton passId={pass.id} /> : null}
          <WalletActions
            passId={pass.id}
            blockReason={blockReason}
            status={status}
            platformHint={platformHint}
          />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pass details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Organization" value={pass.organization.name} />
              <Detail label="Pass type" value={passTypeLabel(pass.passType)} />
              <Detail label="Serial number" value={pass.serialNumber} />
              <Detail label="Status" value={pass.status} />
              {pass.validity.expirationDateEnabled ? (
                <Detail label="Expires" value={formatExpirationDate(pass.validity.expirationDate)} />
              ) : null}
              {pass.barcode.value ? <Detail label="Barcode" value={pass.barcode.value} /> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {events.length === 0 ? (
                <p className="text-muted-foreground">No wallet events yet.</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-3">
                    <span>{event.event_type.replaceAll("_", " ")}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
