"use client";

import { Building2, Clock, Eye, MapPin, Pencil, Trash2, UserCheck, Users, Video } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { PortalDialog } from "@/components/common/portal-dialog";
import { Button } from "@/components/ui/button";
import type { BackendCalendarEvent } from "@/lib/backend-types";
import { formatEventWhen } from "@/lib/calendar-utils";
import { EVENT_TYPE_LABELS, VISIBILITY_LABELS } from "@/lib/calendar-schema";
import { EVENT_TYPE_STYLES } from "./calendar-styles";

function Row({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EventDetailsDialog({
  event,
  mode,
  onClose,
  onEdit,
  onDelete,
}: {
  event: BackendCalendarEvent;
  mode: "staff" | "student";
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const audience =
    event.visibility === "TARGETED"
      ? [
          event.targetBatches.length ? `Batch ${event.targetBatches.join(", ")}` : null,
          event.targetBranches.length ? event.targetBranches.join(", ") : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : event.visibility === "ATTENDEES" && mode === "staff"
        ? `${event.attendeeCount} student${event.attendeeCount === 1 ? "" : "s"}`
        : null;

  return (
    <PortalDialog
      onClose={onClose}
      eyebrow={EVENT_TYPE_LABELS[event.type]}
      title={event.title}
      className="sm:max-w-[520px]"
    >
      <div className="grid gap-3">
        <div className={cn("h-1 rounded-full", EVENT_TYPE_STYLES[event.type].dot)} aria-hidden />
        <Row icon={Clock}>{formatEventWhen(event)} <span className="text-muted-foreground">(IST)</span></Row>
        {event.companyName ? (
          <Row icon={Building2}>
            {event.companyName}
            {event.jobTitle ? <span className="text-muted-foreground"> · {event.jobTitle}</span> : null}
          </Row>
        ) : null}
        {event.location ? <Row icon={MapPin}>{event.location}</Row> : null}
        {event.meetingLink ? (
          <Row icon={Video}>
            <a
              href={event.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-[var(--blue)] underline-offset-2 hover:underline"
            >
              {event.meetingLink}
            </a>
          </Row>
        ) : null}
        {event.pocs.length ? (
          <Row icon={UserCheck}>
            <span className="text-muted-foreground">POC: </span>
            {event.pocs.map((poc, index) => (
              <span key={poc.id}>
                {index ? ", " : ""}
                {poc.email ? (
                  <a className="hover:underline" href={`mailto:${poc.email}`}>
                    {poc.name ?? poc.email}
                  </a>
                ) : (
                  poc.name
                )}
              </span>
            ))}
          </Row>
        ) : null}
        {event.type !== "PERSONAL" ? (
          <Row icon={Eye}>
            {VISIBILITY_LABELS[event.visibility]}
            {audience ? <span className="text-muted-foreground"> · {audience}</span> : null}
          </Row>
        ) : null}
        {mode === "student" && event.isAttendee ? (
          <Row icon={Users}>
            <span className="font-medium text-[var(--badge-green-text)]">You are on the list for this slot.</span>
          </Row>
        ) : null}
        {mode === "staff" && event.attendees?.length ? (
          <Row icon={Users}>
            <details>
              <summary className="cursor-pointer">Attendees ({event.attendees.length})</summary>
              <ul className="mt-1 max-h-40 overflow-y-auto text-muted-foreground">
                {event.attendees.map((person) => (
                  <li key={person.id}>
                    {person.name ?? person.email}
                    {person.rollNumber ? ` (${person.rollNumber})` : ""}
                  </li>
                ))}
              </ul>
            </details>
          </Row>
        ) : null}
        {event.description ? (
          <p className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm whitespace-pre-wrap">{event.description}</p>
        ) : null}
        {mode === "staff" && event.createdByName ? (
          <p className="text-xs text-muted-foreground">Added by {event.createdByName}</p>
        ) : null}

        {event.canEdit ? (
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            {confirming ? (
              <>
                <span className="mr-auto self-center text-sm">Delete this entry? This cannot be undone.</span>
                <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
                  Keep
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    await onDelete();
                    setDeleting(false);
                  }}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
                  <Trash2 /> Delete
                </Button>
                <Button type="button" onClick={onEdit}>
                  <Pencil /> Edit
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </PortalDialog>
  );
}
