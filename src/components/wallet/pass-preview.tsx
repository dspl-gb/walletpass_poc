"use client";

import { QRCodeSVG } from "qrcode.react";
import { Barcode as BarcodeIcon } from "lucide-react";

import type { CommonPass } from "@/lib/wallet/common/schema";
import { passTypeLabel } from "@/lib/wallet/common/schema";
import { cn } from "@/lib/utils";

function alignmentClass(alignment: string): string {
  if (alignment === "center") return "text-center";
  if (alignment === "right") return "text-right";
  return "text-left";
}

function formatStableDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function PassPreview({ pass, className }: { pass: CommonPass; className?: string }) {
  const { appearance, organization, fields, barcode, validity } = pass;
  const bg = appearance.backgroundColor;
  const fg = appearance.foregroundColor;
  const label = appearance.labelColor;

  const headerFields = [...fields.header].sort((a, b) => a.sortOrder - b.sortOrder);
  const primaryFields = [...fields.primary].sort((a, b) => a.sortOrder - b.sortOrder);
  const secondaryFields = [...fields.secondary].sort((a, b) => a.sortOrder - b.sortOrder);
  const auxiliaryFields = [...fields.auxiliary].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <article
      className={cn("relative overflow-hidden rounded-[28px] shadow-xl", className)}
      style={{ backgroundColor: bg, color: fg }}
    >
      {appearance.strip ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={appearance.strip} alt="" className="h-24 w-full object-cover" />
      ) : null}

      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {appearance.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={appearance.logo} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: `${label}33`, color: label }}
              >
                {(organization.logoText || organization.name || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-[0.18em]" style={{ color: label }}>
                {organization.logoText || organization.name || "Organization"}
              </p>
              <p className="truncate text-xs opacity-70">{passTypeLabel(pass.passType)}</p>
            </div>
          </div>
          {headerFields.map((field) => (
            <div key={field.key} className={cn("shrink-0 text-xs", alignmentClass(field.textAlignment))}>
              {field.label ? (
                <p className="text-[10px] uppercase tracking-wider opacity-60">{field.label}</p>
              ) : null}
              <p className="font-medium">{field.value || "—"}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {primaryFields.map((field) => (
            <div key={field.key} className={alignmentClass(field.textAlignment)}>
              {field.label ? (
                <p className="text-[10px] uppercase tracking-wider opacity-60">{field.label}</p>
              ) : null}
              <p className="font-display text-2xl font-semibold tracking-tight">{field.value || pass.name || "Pass Title"}</p>
            </div>
          ))}

          {(secondaryFields.length > 0 || auxiliaryFields.length > 0) && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[...secondaryFields, ...auxiliaryFields].map((field) => (
                <div key={field.key} className={alignmentClass(field.textAlignment)}>
                  {field.label ? (
                    <p className="text-[10px] uppercase tracking-wider opacity-60">{field.label}</p>
                  ) : null}
                  <p className="font-medium">{field.value || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {barcode.value ? (
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="rounded-xl bg-white p-2">
              {barcode.type === "QR" ? (
                <QRCodeSVG value={barcode.value} size={96} level="M" marginSize={0} />
              ) : (
                <div className="flex h-24 w-48 items-center justify-center gap-2 text-neutral-800">
                  <BarcodeIcon className="h-8 w-8" />
                  <span className="text-xs font-mono">{barcode.type}</span>
                </div>
              )}
            </div>
            {barcode.altText ? (
              <span className="text-[10px] uppercase tracking-widest opacity-60">{barcode.altText}</span>
            ) : null}
          </div>
        ) : null}

        {validity.expirationDateEnabled && validity.expirationDate ? (
          <p className="mt-4 text-center text-[10px] uppercase tracking-wider opacity-50">
            Expires {formatStableDate(validity.expirationDate)}
          </p>
        ) : null}
      </div>

      <div className="border-t px-5 py-2 text-center text-[10px] uppercase tracking-wider opacity-40" style={{ borderColor: `${fg}22` }}>
        {pass.status} · {pass.serialNumber || "No serial"}
      </div>
    </article>
  );
}

/** @deprecated Use PassPreview */
export const PassCard = PassPreview;
