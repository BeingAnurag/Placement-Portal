"use client";

import { Eye, Lock, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * One encrypted identity document — Aadhaar, PAN, or the college ID card.
 *
 * All three behave identically (a number encrypted at rest that doubles as the
 * challenge unlocking the scan), so they share this row rather than repeating
 * ~200 lines of markup each. Built on the shadcn primitives, which resolve to
 * the institute palette through the token bridge in `globals.css`.
 */
export type IdentityDocumentRowProps = {
  title: string;
  icon: ReactNode;
  /** Masked form of the stored number, e.g. "•••• •••• 1234". */
  masked?: string | null;
  /** Whether a number is on record. */
  provided: boolean;
  /** Whether a scan has been uploaded. */
  docProvided: boolean;
  docFileName?: string | null;
  fallbackFileName: string;
  onEditNumber: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onUpload: () => void;
};

export function IdentityDocumentRow({
  title,
  icon,
  masked,
  provided,
  docProvided,
  docFileName,
  fallbackFileName,
  onEditNumber,
  onPreview,
  onDelete,
  onUpload,
}: IdentityDocumentRowProps) {
  return (
    <div className="grid gap-2.5 rounded-lg border border-border bg-muted p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon}
          <div className="min-w-0">
            <strong className="block truncate text-xs text-foreground">{title}</strong>
            <span className="text-[11px] text-muted-foreground">
              {masked || (provided ? "Encrypted on file" : "Number not added")}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={provided ? "default" : "secondary"} className="text-[9px]">
            {provided ? "Number added" : "Missing"}
          </Badge>
          <Button type="button" variant="outline" size="sm" onClick={onEditNumber}>
            {provided ? "Edit number" : "Add number"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-border pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {docProvided ? (
            <>
              <ShieldCheck className="size-3.5 shrink-0 text-[color:var(--green)]" />
              <span className="truncate text-[10px] font-semibold text-foreground">
                {docFileName || fallbackFileName} (AES-256 encrypted)
              </span>
            </>
          ) : (
            <>
              <Lock className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">No document file uploaded</span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {docProvided && (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={onPreview}>
                <Eye />
                Preview
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={onDelete}
                aria-label={`Remove ${title} document`}
                title={`Remove ${title} document`}
              >
                <Trash2 />
              </Button>
            </>
          )}
          <Button type="button" size="sm" onClick={onUpload}>
            <UploadCloud />
            {docProvided ? "Replace doc" : "Upload doc"}
          </Button>
        </div>
      </div>
    </div>
  );
}
