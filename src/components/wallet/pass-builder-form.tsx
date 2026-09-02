"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Eye, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldListEditor } from "@/components/wallet/field-list-editor";
import { PassPreview } from "@/components/wallet/pass-preview";
import { createGreenbackPassInput } from "@/lib/branding/greenback";
import { defaultFieldsForType } from "@/lib/wallet/common/defaults";
import type { CommonPass, PassLocation, PassType } from "@/lib/wallet/common/schema";
import { BARCODE_TYPES, PASS_TYPES, passTypeLabel } from "@/lib/wallet/common/schema";
import type { CommonPassInputParsed } from "@/lib/wallet/common/validation";

interface PassBuilderFormProps {
  initialPass?: CommonPass;
  mode?: "create" | "edit";
}

type FormState = Omit<CommonPassInputParsed, "serialNumber"> & { serialNumber: string };

function passToFormState(pass: CommonPass): FormState {
  return {
    name: pass.name,
    passType: pass.passType,
    organization: pass.organization,
    appearance: pass.appearance,
    fields: pass.fields,
    barcode: pass.barcode,
    validity: pass.validity,
    locations: pass.locations,
    serialNumber: pass.serialNumber,
    status: pass.status,
  };
}

export function PassBuilderForm({ initialPass, mode = "create" }: PassBuilderFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(
    initialPass ? passToFormState(initialPass) : createGreenbackPassInput(),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("basic");
  const [passId, setPassId] = useState(initialPass?.id ?? "");
  const [sessionReady, setSessionReady] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/session", { credentials: "same-origin" })
      .then((response) => {
        if (response.ok) setSessionReady(true);
      })
      .catch(() => {
        // Middleware may still have issued a cookie on a prior navigation.
        setSessionReady(true);
      });
  }, []);

  const previewPass: CommonPass = {
    id: passId || "preview",
    userId: initialPass?.userId ?? null,
    ...form,
    status: form.status ?? "draft",
    createdAt: initialPass?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updateForm = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  function handlePassTypeChange(passType: PassType) {
    setForm((prev) => ({
      ...prev,
      passType,
      fields: defaultFieldsForType(passType),
    }));
  }

  async function persistPass(overrides: Partial<FormState> = {}): Promise<CommonPass> {
    if (!passId) throw new Error("Save the pass as a draft first.");
    const payload = { ...form, ...overrides, status: overrides.status ?? form.status ?? "draft" };
    const response = await fetch(`/api/passes/${passId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    });
    const body = (await response.json()) as { pass?: CommonPass; error?: { message?: string } };
    if (!response.ok || !body.pass) {
      throw new Error(body.error?.message ?? "Could not save the pass.");
    }
    return body.pass;
  }

  async function savePass(status: "draft" | "published") {
    setPending(true);
    setError(null);
    try {
      const payload = { ...form, status };
      const isEdit = mode === "edit" && passId;
      const response = await fetch(isEdit ? `/api/passes/${passId}` : "/api/passes", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });
      const body = (await response.json()) as { pass?: CommonPass; error?: { message?: string } };
      if (!response.ok || !body.pass) {
        throw new Error(body.error?.message ?? "Could not save the pass.");
      }
      setPassId(body.pass.id);
      if (status === "published" && isEdit) {
        await fetch(`/api/passes/${body.pass.id}/publish`, { method: "POST" });
      }
      router.push(`/passes/${body.pass.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the pass.");
      setPending(false);
    }
  }

  async function uploadImage(assetType: "logo" | "strip" | "thumbnail" | "background", file: File) {
    if (!passId) {
      setError("Save the pass as a draft first, then upload images.");
      return;
    }
    if (!sessionReady) {
      setError("Session is still starting. Wait a moment and try again.");
      return;
    }
    setError(null);
    setNotice(null);
    setUploadingAsset(assetType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("passId", passId);
      formData.append("assetType", assetType);
      const response = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const body = (await response.json()) as { url?: string; message?: string; error?: { message?: string } };
      if (!response.ok || !body.url) {
        throw new Error(body.error?.message ?? body.message ?? "Upload failed.");
      }

      const newAppearance = { ...form.appearance, [assetType]: body.url };
      setForm((prev) => ({
        ...prev,
        appearance: newAppearance,
      }));

      await persistPass({ appearance: newAppearance });
      setNotice(`${assetType.charAt(0).toUpperCase()}${assetType.slice(1)} saved. Regenerate the wallet pass to see it on your phone.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setUploadingAsset(null);
    }
  }

  const sections = [
    { id: "basic", label: "Basic" },
    { id: "appearance", label: "Appearance" },
    { id: "fields", label: "Fields" },
    { id: "barcode", label: "Barcode" },
    { id: "dates", label: "Dates" },
    { id: "locations", label: "Locations" },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <Button
              key={s.id}
              type="button"
              variant={activeSection === s.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveSection(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        {activeSection === "basic" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
              <CardDescription>Pass identity and organization details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Pass Name" required value={form.name} onChange={(v) => updateForm("name", v)} />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Pass Type</span>
                <select
                  value={form.passType}
                  onChange={(e) => handlePassTypeChange(e.target.value as PassType)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {PASS_TYPES.map((t) => (
                    <option key={t} value={t}>{passTypeLabel(t)}</option>
                  ))}
                </select>
              </label>
              <FormField label="Organization Name" required value={form.organization.name} onChange={(v) => updateForm("organization", { ...form.organization, name: v })} />
              <FormField label="Description" value={form.organization.description} onChange={(v) => updateForm("organization", { ...form.organization, description: v })} />
              <FormField label="Logo Text" value={form.organization.logoText} onChange={(v) => updateForm("organization", { ...form.organization, logoText: v })} />
              <ImageUploadField
                label="Logo"
                url={form.appearance.logo ?? ""}
                onUrlChange={(v) => updateForm("appearance", { ...form.appearance, logo: v || null })}
                onUpload={(file) => uploadImage("logo", file)}
                disabled={!passId}
                uploading={uploadingAsset === "logo"}
                hint="Defaults to Aeropay. Upload your own or paste a URL."
              />
              <FormField label="Serial Number / Pass ID" value={form.serialNumber} onChange={(v) => updateForm("serialNumber", v)} hint="Auto-generated if left blank on first save." />
            </CardContent>
          </Card>
        )}

        {activeSection === "appearance" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appearance</CardTitle>
              <CardDescription>Colors and images for your pass.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <ColorField label="Background" value={form.appearance.backgroundColor} onChange={(v) => updateForm("appearance", { ...form.appearance, backgroundColor: v })} />
                <ColorField label="Foreground" value={form.appearance.foregroundColor} onChange={(v) => updateForm("appearance", { ...form.appearance, foregroundColor: v })} />
                <ColorField label="Label" value={form.appearance.labelColor} onChange={(v) => updateForm("appearance", { ...form.appearance, labelColor: v })} />
              </div>
              {(["strip", "thumbnail", "background"] as const).map((asset) => (
                <ImageUploadField
                  key={asset}
                  label={asset.charAt(0).toUpperCase() + asset.slice(1)}
                  url={form.appearance[asset] ?? ""}
                  onUrlChange={(v) => updateForm("appearance", { ...form.appearance, [asset]: v || null })}
                  onUpload={(file) => uploadImage(asset, file)}
                  disabled={!passId}
                  uploading={uploadingAsset === asset}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {activeSection === "fields" && (
          <div className="space-y-6">
            {(["header", "primary", "secondary", "auxiliary"] as const).map((group) => (
              <Card key={group}>
                <CardContent className="pt-6">
                  <FieldListEditor
                    title={`${group.charAt(0).toUpperCase()}${group.slice(1)} Fields`}
                    fields={form.fields[group]}
                    onChange={(fields) => updateForm("fields", { ...form.fields, [group]: fields })}
                  />
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="pt-6">
                <FieldListEditor
                  title="Back Fields"
                  description="Shown on the back of the pass."
                  fields={form.fields.back}
                  onChange={(fields) => updateForm("fields", { ...form.fields, back: fields })}
                  showAlignment={false}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === "barcode" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Barcode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Barcode Type</span>
                <select
                  value={form.barcode.type}
                  onChange={(e) => updateForm("barcode", { ...form.barcode, type: e.target.value as typeof form.barcode.type })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {BARCODE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <FormField label="Barcode Value" value={form.barcode.value} onChange={(v) => updateForm("barcode", { ...form.barcode, value: v })} />
              <FormField label="Alternate Text" value={form.barcode.altText} onChange={(v) => updateForm("barcode", { ...form.barcode, altText: v })} />
            </CardContent>
          </Card>
        )}

        {activeSection === "dates" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Date & Validity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DateField label="Relevant Date" enabled={form.validity.relevantDateEnabled} date={form.validity.relevantDate} onEnabledChange={(v) => updateForm("validity", { ...form.validity, relevantDateEnabled: v })} onDateChange={(v) => updateForm("validity", { ...form.validity, relevantDate: v })} />
              <DateField label="Expiration Date" enabled={form.validity.expirationDateEnabled} date={form.validity.expirationDate} onEnabledChange={(v) => updateForm("validity", { ...form.validity, expirationDateEnabled: v })} onDateChange={(v) => updateForm("validity", { ...form.validity, expirationDate: v })} />
              <DateField label="Valid From" enabled={form.validity.validFromEnabled} date={form.validity.validFrom} onEnabledChange={(v) => updateForm("validity", { ...form.validity, validFromEnabled: v })} onDateChange={(v) => updateForm("validity", { ...form.validity, validFrom: v })} />
              <DateField label="Valid Until" enabled={form.validity.validUntilEnabled} date={form.validity.validUntil} onEnabledChange={(v) => updateForm("validity", { ...form.validity, validUntilEnabled: v })} onDateChange={(v) => updateForm("validity", { ...form.validity, validUntil: v })} />
            </CardContent>
          </Card>
        )}

        {activeSection === "locations" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Locations</CardTitle>
              <CardDescription>
                Geofence triggers when the pass is nearby. Use real latitude/longitude — the default 0, 0 is ignored and will not appear in pass.json.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LocationEditor locations={form.locations} onChange={(locations) => updateForm("locations", locations)} />
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={pending} onClick={() => savePass("draft")}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => savePass("published")}>
            Publish
          </Button>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {notice ? (
          <Alert>
            <AlertTitle>Saved</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          Live Preview
        </div>
        <PassPreview pass={previewPass} />
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, required, hint }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}{required ? <span className="text-destructive"> *</span> : null}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} required={required} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono" />
      </div>
    </label>
  );
}

function ImageUploadField({
  label,
  url,
  onUrlChange,
  onUpload,
  disabled,
  uploading,
  hint,
}: {
  label: string;
  url: string;
  onUrlChange: (v: string) => void;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  uploading?: boolean;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openFilePicker() {
    if (disabled || uploading) return;
    inputRef.current?.click();
  }

  return (
    <div className="space-y-2">
      <FormField
        label={`${label} URL`}
        value={url}
        onChange={onUrlChange}
        hint={hint ?? (disabled ? "Save draft first to enable upload." : "Or upload an image below.")}
      />
      {url ? (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={disabled || uploading}
          className="block rounded border bg-white/5 p-1 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Change ${label.toLowerCase()}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${label} preview`} className="h-16 w-auto max-w-full object-contain" />
        </button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || uploading}
        onClick={openFilePicker}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? `Uploading ${label.toLowerCase()}…` : `Upload ${label}`}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        disabled={disabled || uploading}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) await onUpload(f);
        }}
      />
    </div>
  );
}

function DateField({ label, enabled, date, onEnabledChange, onDateChange }: { label: string; enabled: boolean; date: string | null; onEnabledChange: (v: boolean) => void; onDateChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
        {label}
      </label>
      {enabled ? (
        <input
          type="datetime-local"
          value={date ? date.slice(0, 16) : ""}
          onChange={(e) => onDateChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        />
      ) : null}
    </div>
  );
}

function LocationEditor({ locations, onChange }: { locations: PassLocation[]; onChange: (l: PassLocation[]) => void }) {
  function addLocation() {
    onChange([...locations, { latitude: 0, longitude: 0, relevantText: "" }]);
  }
  function update(index: number, patch: Partial<PassLocation>) {
    onChange(locations.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function remove(index: number) {
    onChange(locations.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={addLocation}>Add Location</Button>
      {locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No locations yet. Add one with GPS coordinates (e.g. 37.7749, -122.4194).</p>
      ) : null}
      {locations.map((loc, i) => {
        const isPlaceholder = loc.latitude === 0 && loc.longitude === 0;
        return (
          <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
            <label><span className="text-xs">Latitude</span><input type="number" step="any" value={loc.latitude} onChange={(e) => update(i, { latitude: parseFloat(e.target.value) || 0 })} className="mt-1 flex h-9 w-full rounded-md border px-2 text-sm" placeholder="37.7749" /></label>
            <label><span className="text-xs">Longitude</span><input type="number" step="any" value={loc.longitude} onChange={(e) => update(i, { longitude: parseFloat(e.target.value) || 0 })} className="mt-1 flex h-9 w-full rounded-md border px-2 text-sm" placeholder="-122.4194" /></label>
            <label><span className="text-xs">Relevant Text</span><input type="text" value={loc.relevantText} onChange={(e) => update(i, { relevantText: e.target.value })} className="mt-1 flex h-9 w-full rounded-md border px-2 text-sm" placeholder="Shown when nearby" /></label>
            {isPlaceholder ? (
              <p className="text-xs text-amber-600 sm:col-span-3">Enter real coordinates. 0, 0 is ignored and will not be added to the wallet pass.</p>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} className="sm:col-span-3">Remove</Button>
          </div>
        );
      })}
    </div>
  );
}
