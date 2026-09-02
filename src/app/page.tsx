import Link from "next/link";

import { ArrowRight, Plus } from "lucide-react";



import { Button } from "@/components/ui/button";

import { PassPreview } from "@/components/wallet/pass-preview";

import { StatusBanner } from "@/components/wallet/status-banner";

import { getWalletConfigStatus } from "@/lib/config/env";

import { isUsingMemoryStore } from "@/lib/db/passes";

import { memoryCreatePreviewPass } from "@/lib/db/memory";

export const dynamic = "force-dynamic";



export default function HomePage() {

  const status = getWalletConfigStatus();

  const previewPass = memoryCreatePreviewPass();



  return (

    <div className="container py-12 sm:py-16">

      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">

        <div className="space-y-6">

          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">

            Dynamic Pass Builder

          </p>

          <h1 className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">

            Design wallet passes and add them to Apple Wallet and Google Wallet.

          </h1>

          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">

            Build any supported pass type with a dynamic form, preview it live, save to Supabase, and

            generate signed passes — all from one common pass model.

          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

            <Button asChild size="lg">

              <Link href="/passes/new">

                <Plus className="h-4 w-4" />

                Create a pass

              </Link>

            </Button>

            <Button asChild variant="outline" size="lg">

              <Link href="/dashboard">

                Open dashboard

                <ArrowRight className="h-4 w-4" />

              </Link>

            </Button>

          </div>

        </div>

        <PassPreview pass={previewPass} />

      </div>

      <div className="mt-12">

        <StatusBanner status={status} memoryStore={isUsingMemoryStore()} />

      </div>

    </div>

  );

}


