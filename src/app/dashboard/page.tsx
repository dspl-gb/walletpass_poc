import Link from "next/link";

import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PassPreview } from "@/components/wallet/pass-preview";
import { StatusBanner } from "@/components/wallet/status-banner";
import { getWalletConfigStatus } from "@/lib/config/env";
import { listPassesForOwner, isUsingMemoryStore } from "@/lib/db/passes";
import { passTypeLabel } from "@/lib/wallet/common/schema";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const passes = await listPassesForOwner(null);
  const status = getWalletConfigStatus();
  const featured = passes[0] ?? null;

  return (
    <div className="container space-y-8 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Dashboard</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Your passes</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Create, edit, and publish wallet passes. Each pass is stored dynamically and can be
            generated for Apple Wallet or Google Wallet.
          </p>
        </div>
        <Button asChild>
          <Link href="/passes/new">
            <Plus className="h-4 w-4" />
            Create pass
          </Link>
        </Button>
      </div>

      <StatusBanner status={status} memoryStore={isUsingMemoryStore()} />

      {featured ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Link href={`/passes/${featured.id}`} className="block">
            <PassPreview pass={featured} />
          </Link>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest pass</CardTitle>
              <CardDescription>Open the pass to add it to a wallet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Name" value={featured.name} />
              <Row label="Type" value={passTypeLabel(featured.passType)} />
              <Row label="Serial" value={featured.serialNumber} />
              <Row label="Status" value={featured.status} />
              <Link href={`/passes/${featured.id}`} className="inline-flex text-sm font-medium underline-offset-4 hover:underline">
                View pass
              </Link>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No passes yet</CardTitle>
            <CardDescription>Create your first wallet pass with the dynamic builder.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/passes/new">
                <Plus className="h-4 w-4" />
                Create pass
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {passes.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl tracking-tight">All passes</h2>
            <p className="text-sm text-muted-foreground">
              {passes.length} pass{passes.length === 1 ? "" : "es"} in your account
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {passes.map((pass) => (
              <Link key={pass.id} href={`/passes/${pass.id}`}>
                <Card className="h-full transition-colors hover:bg-accent/40">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{pass.name}</CardTitle>
                      <Badge variant="secondary">{pass.status}</Badge>
                    </div>
                    <CardDescription>
                      {pass.serialNumber} · {passTypeLabel(pass.passType)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {pass.organization.name}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
