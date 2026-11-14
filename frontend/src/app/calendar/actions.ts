"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { backendFetch } from "@/lib/api-client";
import { auth } from "@/lib/auth";
import type { BackendCalendarSaveResponse } from "@/lib/backend-types";
import {
  calendarEventFormSchema,
  toCalendarPayload,
  type CalendarEventFormValues,
} from "@/lib/calendar-schema";

export type CalendarActionResult = { error?: string; success?: string; warnings?: string[] };

// One pair of actions serves both calendars. Who may write what is decided by
// FastAPI (calendar.manage for shared entries, authorship for personal
// reminders), so this layer only validates the shape and forwards the token;
// a second copy of the rule here could only drift from the real one.

function backendMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(error.message) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail) && parsed.detail[0] && typeof parsed.detail[0].msg === "string") {
      return String(parsed.detail[0].msg).replace(/^Value error, /, "");
    }
  } catch {
    // The backend returned plain text rather than a JSON error body.
  }
  return error.message || fallback;
}

function revalidateCalendars() {
  revalidatePath("/calendar");
  revalidatePath("/admin/calendar");
}

export async function saveCalendarEventAction(values: CalendarEventFormValues): Promise<CalendarActionResult> {
  const session = await auth();
  if (!session?.user) return { error: "Your session has expired. Sign in again." };

  const parsed = calendarEventFormSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the entry details." };
  }

  const { id } = parsed.data;
  const payload = toCalendarPayload(parsed.data);

  try {
    const saved = await backendFetch<BackendCalendarSaveResponse>(
      id ? `/api/v1/calendar/events/${encodeURIComponent(id)}` : "/api/v1/calendar/events",
      { method: id ? "PUT" : "POST", body: JSON.stringify(payload), cache: "no-store" },
    );
    revalidateCalendars();
    return {
      success: id ? `Updated "${saved.event.title}".` : `Added "${saved.event.title}" to the calendar.`,
      warnings: saved.warnings,
    };
  } catch (error) {
    return { error: backendMessage(error, "The entry could not be saved.") };
  }
}

const deleteSchema = z.object({ id: z.string().trim().min(1) });

export async function deleteCalendarEventAction(input: { id: string }): Promise<CalendarActionResult> {
  const session = await auth();
  if (!session?.user) return { error: "Your session has expired. Sign in again." };

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { error: "Pick an entry to delete." };

  try {
    await backendFetch(`/api/v1/calendar/events/${encodeURIComponent(parsed.data.id)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    revalidateCalendars();
    return { success: "Entry deleted." };
  } catch (error) {
    return { error: backendMessage(error, "The entry could not be deleted.") };
  }
}
