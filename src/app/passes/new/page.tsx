import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PassBuilderForm } from "@/components/wallet/pass-builder-form";

export default function NewPassPage() {
  return (
    <div className="container space-y-8 py-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Pass Builder</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Create a new pass</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Design your pass with the form below. The preview updates in real time as you edit.
        </p>
      </div>
      <PassBuilderForm mode="create" />
    </div>
  );
}
