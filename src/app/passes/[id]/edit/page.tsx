import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PassBuilderForm } from "@/components/wallet/pass-builder-form";
import { assertPassOwnership, getPassById } from "@/lib/db/passes";
import { getOwnerId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EditPassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pass = await getPassById(id);
  if (!pass) notFound();

  const ownerId = await getOwnerId();
  try {
    assertPassOwnership(pass, ownerId);
  } catch {
    notFound();
  }

  return (
    <div className="container space-y-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Pass Builder</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Edit pass</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/passes/${id}`}>View pass</Link>
        </Button>
      </div>
      <PassBuilderForm initialPass={pass} mode="edit" />
    </div>
  );
}
