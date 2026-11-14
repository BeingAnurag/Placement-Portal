import assert from "node:assert/strict";
import test from "node:test";
import type { BackendCalendarEvent } from "./backend-types";
import {
  calendarEventFormSchema,
  calendarFormFromEvent,
  emptyCalendarForm,
  toCalendarPayload,
  type CalendarEventFormValues,
} from "./calendar-schema";

function staffForm(overrides: Partial<CalendarEventFormValues> = {}): CalendarEventFormValues {
  return { ...emptyCalendarForm("2026-11-20", "10:00", "staff"), title: "Acme visit", ...overrides };
}

test("a blank staff form starts as a one-hour, team-only company visit", () => {
  const form = emptyCalendarForm("2026-11-20", "10:00", "staff");
  assert.equal(form.type, "COMPANY_VISIT");
  assert.equal(form.visibility, "STAFF");
  assert.equal(form.endTime, "11:00");
});

test("a blank student form is a private reminder", () => {
  const form = emptyCalendarForm("2026-11-20", "23:30", "student");
  assert.equal(form.type, "PERSONAL");
  assert.equal(form.visibility, "PRIVATE");
  assert.equal(form.endTime, "23:59");
});

test("the payload carries IST times as UTC instants", () => {
  const parsed = calendarEventFormSchema.parse(staffForm({ endTime: "12:30" }));
  const payload = toCalendarPayload(parsed);
  assert.equal(payload.startsAt, "2026-11-20T04:30:00.000Z");
  assert.equal(payload.endsAt, "2026-11-20T07:00:00.000Z");
  assert.equal(payload.location, null);
});

test("an all-day entry runs midnight to midnight", () => {
  const parsed = calendarEventFormSchema.parse(staffForm({ allDay: true, endDate: "2026-11-21" }));
  const payload = toCalendarPayload(parsed);
  assert.equal(payload.startsAt, "2026-11-19T18:30:00.000Z");
  assert.equal(payload.endsAt, "2026-11-21T18:30:00.000Z");
});

test("an end before the start is refused", () => {
  const result = calendarEventFormSchema.safeParse(staffForm({ endTime: "09:00" }));
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.path[0], "endTime");
});

test("a title is required", () => {
  const result = calendarEventFormSchema.safeParse(staffForm({ title: "   " }));
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.path[0], "title");
});

test("targeted entries need a batch or branch", () => {
  assert.equal(calendarEventFormSchema.safeParse(staffForm({ visibility: "TARGETED" })).success, false);
  const ok = calendarEventFormSchema.parse(staffForm({ visibility: "TARGETED", targetBatches: [2027] }));
  assert.deepEqual(toCalendarPayload(ok).targetBatches, [2027]);
});

test("attendee entries need students, either by name or from a drive", () => {
  assert.equal(
    calendarEventFormSchema.safeParse(staffForm({ type: "INTERVIEW", visibility: "ATTENDEES" })).success,
    false,
  );
  const fromDrive = calendarEventFormSchema.parse(
    staffForm({
      type: "INTERVIEW",
      visibility: "ATTENDEES",
      jobProfileId: "job_1",
      attendeeSourceStatuses: ["INTERVIEW"],
    }),
  );
  assert.deepEqual(toCalendarPayload(fromDrive).attendeesFromJob, {
    jobProfileId: "job_1",
    statuses: ["INTERVIEW"],
  });
});

test("fields that do not apply to the visibility are dropped from the payload", () => {
  const parsed = calendarEventFormSchema.parse(
    staffForm({ visibility: "STUDENTS", targetBatches: [2027], attendeeIds: ["stu_1"] }),
  );
  const payload = toCalendarPayload(parsed);
  assert.deepEqual(payload.targetBatches, []);
  assert.deepEqual(payload.attendeeIds, []);
  assert.equal(payload.attendeesFromJob, null);
});

test("personal reminders must be private", () => {
  const result = calendarEventFormSchema.safeParse(staffForm({ type: "PERSONAL", visibility: "STUDENTS" }));
  assert.equal(result.success, false);
});

test("meeting links must be web links", () => {
  assert.equal(calendarEventFormSchema.safeParse(staffForm({ meetingLink: "meet.google.com/x" })).success, false);
  assert.equal(
    calendarEventFormSchema.safeParse(staffForm({ meetingLink: "https://meet.google.com/x" })).success,
    true,
  );
});

test("editing an event round-trips its times", () => {
  const event = {
    id: "ev_1",
    title: "Acme",
    description: null,
    type: "INTERVIEW",
    startsAt: "2026-11-20T04:30:00Z",
    endsAt: "2026-11-20T05:15:00Z",
    allDay: false,
    location: null,
    meetingLink: null,
    companyId: "co_1",
    companyName: "Acme",
    jobProfileId: null,
    jobTitle: null,
    visibility: "ATTENDEES",
    targetBatches: [],
    targetBranches: [],
    createdById: "u",
    createdByName: null,
    pocs: [{ id: "u_a", name: "Asha", email: null }],
    attendees: [{ id: "stu_1", name: "S", email: null }],
    attendeeCount: 1,
    isAttendee: false,
    canEdit: true,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  } satisfies BackendCalendarEvent;
  const form = calendarFormFromEvent(event);
  assert.equal(form.startDate, "2026-11-20");
  assert.equal(form.startTime, "10:00");
  assert.equal(form.endTime, "10:45");
  assert.deepEqual(form.pocIds, ["u_a"]);
  assert.deepEqual(form.attendeeIds, ["stu_1"]);

  const allDay = calendarFormFromEvent({
    ...event,
    allDay: true,
    startsAt: "2026-11-19T18:30:00Z",
    endsAt: "2026-11-20T18:30:00Z",
  });
  assert.equal(allDay.startDate, "2026-11-20");
  assert.equal(allDay.endDate, "2026-11-20");
});
