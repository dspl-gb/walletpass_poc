"use client";

import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FieldGroup, PassField, TextAlignment } from "@/lib/wallet/common/schema";
import { TEXT_ALIGNMENTS } from "@/lib/wallet/common/schema";

interface FieldListEditorProps {
  title: string;
  description?: string;
  fields: PassField[];
  onChange: (fields: PassField[]) => void;
  showAlignment?: boolean;
}

export function FieldListEditor({
  title,
  description,
  fields,
  onChange,
  showAlignment = true,
}: FieldListEditorProps) {
  function updateField(index: number, patch: Partial<PassField>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(next);
  }

  function addField() {
    const key = `field_${fields.length + 1}`;
    onChange([
      ...fields,
      { key, label: "LABEL", value: "", textAlignment: "left", sortOrder: fields.length },
    ]);
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, sortOrder: i })));
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((f, i) => ({ ...f, sortOrder: i })));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus className="h-3.5 w-3.5" />
          Add field
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No fields yet.</p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={`${field.key}-${index}`} className="flex gap-2 rounded-lg border p-3">
              <div className="flex flex-col gap-1 pt-1">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <button type="button" onClick={() => moveField(index, -1)} className="text-muted-foreground hover:text-foreground" aria-label="Move up">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => moveField(index, 1)} className="text-muted-foreground hover:text-foreground" aria-label="Move down">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <Input label="Key" value={field.key} onChange={(v) => updateField(index, { key: v })} />
                <Input label="Label" value={field.label} onChange={(v) => updateField(index, { label: v })} />
                <Input label="Value" value={field.value} onChange={(v) => updateField(index, { value: v })} className="sm:col-span-2" />
                {showAlignment ? (
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-xs font-medium">Alignment</span>
                    <select
                      value={field.textAlignment}
                      onChange={(e) => updateField(index, { textAlignment: e.target.value as TextAlignment })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      {TEXT_ALIGNMENTS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeField(index)} aria-label="Delete field">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-xs font-medium">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
      />
    </label>
  );
}

export type { FieldGroup };
