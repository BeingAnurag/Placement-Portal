import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  addMonths,
  dayKeyOf,
  eventDays,
  formatTime,
  formatTimeRange,
  groupByDay,
  isDayKey,
  istToInstant,
  layoutDay,
  monthMatrix,
  parseCalendarParams,
  rangeQuery,
  shiftAnchor,
  startOfWeek,
  timeInputOf,
  visibleDays,
  weekDays,
} from "./calendar-utils";

const ev = (id: string, startsAt: string, endsAt: string, allDay = false) => ({ id, startsAt, endsAt, allDay });

test("day keys are read in IST, not in the runtime's zone", () => {
  // 20:00 UTC on the 19th is 01:30 IST on the 20th.
  assert.equal(dayKeyOf("2026-11-19T20:00:00Z"), "2026-11-20");
  assert.equal(dayKeyOf("2026-11-19T18:29:00Z"), "2026-11-19");
  assert.equal(timeInputOf("2026-11-20T04:30:00Z"), "10:00");
});

test("an IST date and time convert to the right instant", () => {
  assert.equal(istToInstant("2026-11-20", "10:00").toISOString(), "2026-11-20T04:30:00.000Z");
  assert.equal(istToInstant("2026-11-20").toISOString(), "2026-11-19T18:30:00.000Z");
});

test("day key validation rejects impossible dates", () => {
  assert.equal(isDayKey("2026-02-28"), true);
  assert.equal(isDayKey("2026-02-30"), false);
  assert.equal(isDayKey("20-11-2026"), false);
  assert.equal(isDayKey(undefined), false);
});

test("day and month arithmetic", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-01");
  assert.equal(addMonths("2026-01-15", -1), "2025-12-01");
  // 20 Nov 2026 is a Friday; weeks start on Monday the 16th.
  assert.equal(startOfWeek("2026-11-20"), "2026-11-16");
  assert.equal(startOfWeek("2026-11-16"), "2026-11-16");
  assert.equal(startOfWeek("2026-11-22"), "2026-11-16");
});

test("month matrix covers whole weeks from Monday", () => {
  const weeks = monthMatrix("2026-11-20");
  assert.equal(weeks[0][0], "2026-10-26");
  assert.equal(weeks[weeks.length - 1][6], "2026-12-06");
  assert.ok(weeks.every((week) => week.length === 7));
  assert.equal(weeks.length, 6);
});

test("visible ranges and the API query for each view", () => {
  assert.deepEqual(visibleDays("week", "2026-11-20"), { start: "2026-11-16", end: "2026-11-23" });
  assert.deepEqual(visibleDays("agenda", "2026-11-20"), { start: "2026-11-01", end: "2026-12-01" });
  assert.deepEqual(visibleDays("month", "2026-11-20"), { start: "2026-10-26", end: "2026-12-07" });
  assert.deepEqual(rangeQuery("week", "2026-11-20"), {
    from: "2026-11-15T18:30:00.000Z",
    to: "2026-11-22T18:30:00.000Z",
  });
  assert.deepEqual(weekDays("2026-11-20").length, 7);
});

test("navigation moves by a week or a month", () => {
  assert.equal(shiftAnchor("week", "2026-11-20", 1), "2026-11-27");
  assert.equal(shiftAnchor("month", "2026-11-20", -1), "2026-10-01");
  assert.equal(shiftAnchor("agenda", "2026-12-15", 1), "2027-01-01");
});

test("URL params fall back safely", () => {
  const now = new Date("2026-11-15T06:00:00Z");
  assert.deepEqual(parseCalendarParams({}, now), { view: "month", anchor: "2026-11-15" });
  assert.deepEqual(parseCalendarParams({ view: "week", date: "2026-12-01" }, now), {
    view: "week",
    anchor: "2026-12-01",
  });
  assert.deepEqual(parseCalendarParams({ view: "year", date: "garbage" }, now), {
    view: "month",
    anchor: "2026-11-15",
  });
});

test("an event's days use an exclusive end", () => {
  // All day on the 20th: IST midnight to the next IST midnight.
  assert.deepEqual(eventDays(ev("a", "2026-11-19T18:30:00Z", "2026-11-20T18:30:00Z", true)), ["2026-11-20"]);
  // Two-day visit.
  assert.deepEqual(eventDays(ev("b", "2026-11-20T03:30:00Z", "2026-11-21T11:30:00Z")), [
    "2026-11-20",
    "2026-11-21",
  ]);
  // A zero-length deadline still sits on its day.
  assert.deepEqual(eventDays(ev("c", "2026-11-20T12:30:00Z", "2026-11-20T12:30:00Z")), ["2026-11-20"]);
});

test("grouping puts all-day entries first, then by start", () => {
  const byDay = groupByDay([
    ev("late", "2026-11-20T08:30:00Z", "2026-11-20T09:30:00Z"),
    ev("early", "2026-11-20T03:30:00Z", "2026-11-20T04:30:00Z"),
    ev("allday", "2026-11-19T18:30:00Z", "2026-11-20T18:30:00Z", true),
  ]);
  assert.deepEqual(byDay.get("2026-11-20")?.map((e) => e.id), ["allday", "early", "late"]);
});

test("overlapping events share the width; separate ones do not", () => {
  // 10:00-11:00, 10:30-11:30 and 12:00-13:00 IST.
  const placed = layoutDay(
    [
      ev("a", "2026-11-20T04:30:00Z", "2026-11-20T05:30:00Z"),
      ev("b", "2026-11-20T05:00:00Z", "2026-11-20T06:00:00Z"),
      ev("c", "2026-11-20T06:30:00Z", "2026-11-20T07:30:00Z"),
    ],
    "2026-11-20",
  );
  const byId = Object.fromEntries(placed.map((p) => [p.event.id, p]));
  assert.equal(byId.a.top, 600);
  assert.equal(byId.a.height, 60);
  assert.deepEqual([byId.a.column, byId.a.columns], [0, 2]);
  assert.deepEqual([byId.b.column, byId.b.columns], [1, 2]);
  assert.deepEqual([byId.c.column, byId.c.columns], [0, 1]);
});

test("a short slot still gets a clickable block", () => {
  const [placed] = layoutDay([ev("a", "2026-11-20T04:30:00Z", "2026-11-20T04:35:00Z")], "2026-11-20");
  assert.equal(placed.height, 30);
});

test("times format in IST", () => {
  assert.equal(formatTime("2026-11-20T04:30:00Z"), "10:00 am");
  assert.equal(formatTimeRange(ev("a", "2026-11-20T04:30:00Z", "2026-11-20T07:00:00Z")), "10:00 am – 12:30 pm");
  assert.equal(formatTimeRange(ev("a", "2026-11-19T18:30:00Z", "2026-11-20T18:30:00Z", true)), "All day");
});
