import type { CalendarEventType } from "@/lib/backend-types";

/**
 * One colour per kind of entry, drawn from the badge tokens so both themes
 * stay legible. Personal reminders are neutral and dashed: they are the
 * student's own notes, not something the placement cell announced.
 */
export const EVENT_TYPE_STYLES: Record<CalendarEventType, { chip: string; dot: string }> = {
  COMPANY_VISIT: {
    chip: "bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)] border-l-[var(--blue)]",
    dot: "bg-[var(--blue)]",
  },
  PRE_PLACEMENT_TALK: {
    chip: "bg-[var(--badge-purple-bg)] text-[var(--badge-purple-text)] border-l-[var(--badge-purple-text)]",
    dot: "bg-[var(--badge-purple-text)]",
  },
  TEST: {
    chip: "bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)] border-l-[var(--orange)]",
    dot: "bg-[var(--orange)]",
  },
  INTERVIEW: {
    chip: "bg-[var(--badge-green-bg)] text-[var(--badge-green-text)] border-l-[var(--green)]",
    dot: "bg-[var(--green)]",
  },
  DEADLINE: {
    chip: "bg-[var(--badge-red-bg)] text-[var(--badge-red-text)] border-l-[var(--badge-red-text)]",
    dot: "bg-[var(--badge-red-text)]",
  },
  OTHER: {
    chip: "bg-[var(--surface-alt)] text-[var(--ink)] border-l-[var(--muted)]",
    dot: "bg-[var(--muted)]",
  },
  PERSONAL: {
    chip: "bg-[var(--card-bg)] text-[var(--ink)] border border-dashed border-[var(--border)] border-l-[var(--muted)]",
    dot: "bg-transparent border border-[var(--muted)]",
  },
};
