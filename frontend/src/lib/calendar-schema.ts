import { z } from "zod";
import type { BackendCalendarEvent, CalendarEventType, CalendarVisibility } from "@/lib/backend-types";
import { addDays, dayKeyOf, isDayKey, istToInstant, timeInputOf } from "@/lib/calendar-utils";

/** Types the placement cell can pick. PERSONAL is implied by a student's reminder form. */
export const STAFF_EVENT_TYPES = [
  "COMPANY_VISIT",
  "PRE_PLACEMENT_TALK",
  "TEST",
  "INTERVIEW",
  "DEADLINE",
  "OTHER",
] as const satisfies readonly CalendarEventType[];

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  COMPANY_VISIT: "Company visit / drive",
  PRE_PLACEMENT_TALK: "Pre-placement talk",
  TEST: "Online / written test",
  INTERVIEW: "Interview",
  DEADLINE: "Deadline",
  OTHER: "Other",
  PERSONAL: "Personal reminder",
};

export const STAFF_VISIBILITIES = [
  "STAFF",
  "STUDENTS",
  "TARGETED",
  "ATTENDEES",
] as const satisfies readonly CalendarVisibility[];

export const VISIBILITY_LABELS: Record<CalendarVisibility, string> = {
  STAFF: "Placement team only",
  STUDENTS: "All students",
  TARGETED: "Selected batches / branches",
  ATTENDEES: "Specific students",
  PRIVATE: "Only me",
};

export const VISIBILITY_HINTS: Record<CalendarVisibility, string> = {
  STAFF: "Internal planning. Students never see this entry.",
  STUDENTS: "Every student sees this on their calendar.",
  TARGETED: "Only students in the chosen batches and branches see it.",
  ATTENDEES: "Only the students you add see it — use this for interview slots.",
  PRIVATE: "Nobody else can see this reminder.",
};

/** Application stages a staff member can pull attendees from. */
export const ATTENDEE_SOURCE_STATUSES = ["SHORTLISTED", "INTERVIEW", "APPLIED", "SELECTED"] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value ? value : null))
    .nullable()
    .optional();

const dayKey = z.string().refine(isDayKey, "Pick a valid date.");
const time = z.string().regex(TIME_PATTERN, "Pick a valid time.");

/**
 * The calendar entry form's state, as the dialog holds it: an IST date and
 * wall-clock time rather than instants, because that is what the person
 * picked. `toCalendarPayload` turns it into what the API takes.
 */
export const calendarEventFormSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1, "Give the entry a title.").max(200, "Keep the title under 200 characters."),
    description: optionalText(4000),
    type: z.enum([...STAFF_EVENT_TYPES, "PERSONAL"]),
    startDate: dayKey,
    startTime: time,
    endDate: dayKey,
    endTime: time,
    allDay: z.boolean(),
    location: optionalText(300),
    meetingLink: optionalText(1000).refine(
      (value) => !value || /^https?:\/\//i.test(value),
      "Meeting link must start with http:// or https://.",
    ),
    companyId: z.string().trim().nullable().optional(),
    /** A recruiter not yet on the portal; FastAPI finds or creates it on save. */
    companyName: optionalText(200),
    jobProfileId: z.string().trim().nullable().optional(),
    visibility: z.enum([...STAFF_VISIBILITIES, "PRIVATE"]),
    targetBatches: z.array(z.number().int().min(2000).max(2100)).max(20),
    targetBranches: z.array(z.string().trim().min(1)).max(50),
    pocIds: z.array(z.string().min(1)).max(10),
    attendeeIds: z.array(z.string().min(1)).max(2000),
    attendeeSourceStatuses: z.array(z.enum(ATTENDEE_SOURCE_STATUSES)),
  })
  .superRefine((value, ctx) => {
    const personal = value.type === "PERSONAL";
    if (personal !== (value.visibility === "PRIVATE")) {
      ctx.addIssue({
        code: "custom",
        path: ["visibility"],
        message: "Personal reminders are always private.",
      });
    }
    const { startsAt, endsAt } = instantsOf(value);
    if (endsAt.getTime() < startsAt.getTime()) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "The end must not be before the start." });
    }
    if (value.visibility === "TARGETED" && !value.targetBatches.length && !value.targetBranches.length) {
      ctx.addIssue({
        code: "custom",
        path: ["targetBatches"],
        message: "Pick at least one batch or branch, or share with all students.",
      });
    }
    if (value.visibility === "ATTENDEES") {
      const fromDrive = Boolean(value.jobProfileId) && value.attendeeSourceStatuses.length > 0;
      if (!value.attendeeIds.length && !fromDrive) {
        ctx.addIssue({
          code: "custom",
          path: ["attendeeIds"],
          message: "Add at least one student, or pull them in from a drive's applicants.",
        });
      }
    }
  });

export type CalendarEventFormValues = z.input<typeof calendarEventFormSchema>;
export type CalendarEventFormData = z.output<typeof calendarEventFormSchema>;

function instantsOf(value: {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
}) {
  if (value.allDay) {
    // An all-day entry runs from IST midnight to the midnight after its last day.
    return {
      startsAt: istToInstant(value.startDate),
      endsAt: istToInstant(addDays(value.endDate, 1)),
    };
  }
  return {
    startsAt: istToInstant(value.startDate, value.startTime),
    endsAt: istToInstant(value.endDate, value.endTime),
  };
}

/** The body `POST/PUT /api/v1/calendar/events` takes. */
export type CalendarEventPayload = {
  title: string;
  description: string | null;
  type: CalendarEventType;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  meetingLink: string | null;
  companyId: string | null;
  companyName: string | null;
  jobProfileId: string | null;
  visibility: CalendarVisibility;
  targetBatches: number[];
  targetBranches: string[];
  pocIds: string[];
  attendeeIds: string[];
  attendeesFromJob: { jobProfileId: string; statuses: string[] } | null;
};

export function toCalendarPayload(data: CalendarEventFormData): CalendarEventPayload {
  const personal = data.type === "PERSONAL";
  const { startsAt, endsAt } = instantsOf(data);
  const fromDrive =
    data.visibility === "ATTENDEES" && data.jobProfileId && data.attendeeSourceStatuses.length
      ? { jobProfileId: data.jobProfileId, statuses: [...data.attendeeSourceStatuses] }
      : null;
  return {
    title: data.title,
    description: data.description ?? null,
    type: data.type,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    allDay: data.allDay,
    location: data.location ?? null,
    meetingLink: data.meetingLink ?? null,
    companyId: data.companyId || null,
    // Only one of the two is ever sent: an id wins, and a personal reminder
    // never names a new company.
    companyName: data.companyId || personal ? null : (data.companyName ?? null),
    jobProfileId: data.jobProfileId || null,
    visibility: data.visibility,
    targetBatches: data.visibility === "TARGETED" ? data.targetBatches : [],
    targetBranches: data.visibility === "TARGETED" ? data.targetBranches : [],
    pocIds: personal ? [] : data.pocIds,
    attendeeIds: data.visibility === "ATTENDEES" ? data.attendeeIds : [],
    attendeesFromJob: fromDrive,
  };
}

/** A blank form for a new entry starting at `startDate`/`startTime` and lasting an hour. */
export function emptyCalendarForm(
  startDate: string,
  startTime: string,
  mode: "staff" | "student",
): CalendarEventFormValues {
  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));
  const endMinutes = Math.min(startMinutes + 60, 23 * 60 + 59);
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  return {
    title: "",
    description: "",
    type: mode === "staff" ? "COMPANY_VISIT" : "PERSONAL",
    startDate,
    startTime,
    endDate: startDate,
    endTime,
    allDay: false,
    location: "",
    meetingLink: "",
    companyId: null,
    companyName: null,
    jobProfileId: null,
    visibility: mode === "staff" ? "STAFF" : "PRIVATE",
    targetBatches: [],
    targetBranches: [],
    pocIds: [],
    attendeeIds: [],
    attendeeSourceStatuses: [],
  };
}

/** The form state that re-creates an existing entry, for editing. */
export function calendarFormFromEvent(event: BackendCalendarEvent): CalendarEventFormValues {
  const startDate = dayKeyOf(event.startsAt);
  const endDate = event.allDay
    ? addDays(dayKeyOf(event.endsAt), -1) < startDate
      ? startDate
      : addDays(dayKeyOf(event.endsAt), -1)
    : dayKeyOf(event.endsAt);
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    type: event.type,
    startDate,
    startTime: event.allDay ? "09:00" : timeInputOf(event.startsAt),
    endDate,
    endTime: event.allDay ? "10:00" : timeInputOf(event.endsAt),
    allDay: event.allDay,
    location: event.location ?? "",
    meetingLink: event.meetingLink ?? "",
    companyId: event.companyId,
    companyName: null,
    jobProfileId: event.jobProfileId,
    visibility: event.visibility,
    targetBatches: [...event.targetBatches],
    targetBranches: [...event.targetBranches],
    pocIds: event.pocs.map((poc) => poc.id),
    attendeeIds: (event.attendees ?? []).map((attendee) => attendee.id),
    attendeeSourceStatuses: [],
  };
}
