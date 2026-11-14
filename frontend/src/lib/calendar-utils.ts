/**
 * Date arithmetic for the placement calendar.
 *
 * Everything is done in IST (UTC+05:30, no daylight saving), not in the
 * browser's own zone: the calendar describes events on campus, the server
 * renders it in a container running UTC, and a student checking it from
 * abroad still needs the time the drive happens in Lucknow. A day is a
 * `DayKey` ("2026-11-20"), which compares and sorts as a string and never
 * drifts across a midnight the way a `Date` held in local time does.
 */

export const CALENDAR_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DayKey = string;
export type CalendarView = "month" | "week" | "agenda";
export const CALENDAR_VIEWS: readonly CalendarView[] = ["month", "week", "agenda"];

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function keyFromUtcDate(date: Date): DayKey {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Midnight UTC of the key's date, a neutral anchor for day arithmetic. */
function utcDateOfKey(key: DayKey): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string") return false;
  const match = DAY_KEY_PATTERN.exec(value);
  if (!match) return false;
  const date = utcDateOfKey(value);
  return keyFromUtcDate(date) === value;
}

function toDate(instant: Date | string): Date {
  return typeof instant === "string" ? new Date(instant) : instant;
}

/** The IST wall-clock reading of an instant. */
export function istParts(instant: Date | string) {
  const shifted = new Date(toDate(instant).getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

export function dayKeyOf(instant: Date | string): DayKey {
  const { year, month, day } = istParts(instant);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function todayKey(now: Date = new Date()): DayKey {
  return dayKeyOf(now);
}

/** Minutes past IST midnight. */
export function minutesOfDay(instant: Date | string): number {
  const { hours, minutes } = istParts(instant);
  return hours * 60 + minutes;
}

/** "HH:MM" in IST, the value an `<input type="time">` holds. */
export function timeInputOf(instant: Date | string): string {
  const { hours, minutes } = istParts(instant);
  return `${pad(hours)}:${pad(minutes)}`;
}

/** The instant an IST date and wall-clock time name. */
export function istToInstant(key: DayKey, time = "00:00"): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(utcDateOfKey(key).getTime() + (hours * 60 + minutes) * 60 * 1000 - IST_OFFSET_MS);
}

export function addDays(key: DayKey, days: number): DayKey {
  return keyFromUtcDate(new Date(utcDateOfKey(key).getTime() + days * DAY_MS));
}

export function addMonths(key: DayKey, months: number): DayKey {
  const date = utcDateOfKey(key);
  // Always land on the 1st: "next month" from 31 Jan is February, not 3 March.
  return keyFromUtcDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)));
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((utcDateOfKey(to).getTime() - utcDateOfKey(from).getTime()) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. Weeks start on Monday, as the academic timetable does. */
export function weekdayIndex(key: DayKey): number {
  return (utcDateOfKey(key).getUTCDay() + 6) % 7;
}

export function startOfWeek(key: DayKey): DayKey {
  return addDays(key, -weekdayIndex(key));
}

export function startOfMonth(key: DayKey): DayKey {
  return `${key.slice(0, 7)}-01`;
}

export function isSameMonth(a: DayKey, b: DayKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Full weeks covering the anchor's month, Monday first. Four to six rows. */
export function monthMatrix(anchor: DayKey): DayKey[][] {
  const first = startOfMonth(anchor);
  const last = addDays(addMonths(first, 1), -1);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(startOfWeek(last), 7);
  const weeks: DayKey[][] = [];
  for (let day = gridStart; day < gridEnd; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(day, index)));
  }
  return weeks;
}

export function weekDays(anchor: DayKey): DayKey[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/** The days a view shows, as a half-open [start, end) range of keys. */
export function visibleDays(view: CalendarView, anchor: DayKey): { start: DayKey; end: DayKey } {
  if (view === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7) };
  }
  if (view === "agenda") {
    const start = startOfMonth(anchor);
    return { start, end: addMonths(start, 1) };
  }
  const weeks = monthMatrix(anchor);
  return { start: weeks[0][0], end: addDays(weeks[weeks.length - 1][6], 1) };
}

/** The `from` / `to` query the events endpoint takes for a view. */
export function rangeQuery(view: CalendarView, anchor: DayKey): { from: string; to: string } {
  const { start, end } = visibleDays(view, anchor);
  return { from: istToInstant(start).toISOString(), to: istToInstant(end).toISOString() };
}

export function shiftAnchor(view: CalendarView, anchor: DayKey, direction: -1 | 1): DayKey {
  return view === "week" ? addDays(anchor, 7 * direction) : addMonths(anchor, direction);
}

/** Reads `?view=&date=` with safe fallbacks, so a hand-edited URL never breaks the page. */
export function parseCalendarParams(
  params: { view?: string | string[]; date?: string | string[] },
  now: Date = new Date(),
): { view: CalendarView; anchor: DayKey } {
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const view = CALENDAR_VIEWS.includes(rawView as CalendarView) ? (rawView as CalendarView) : "month";
  const anchor = isDayKey(rawDate) ? rawDate : todayKey(now);
  return { view, anchor };
}

// ---------------------------------------------------------------------------
// Placing events
// ---------------------------------------------------------------------------

export type TimedEvent = {
  id: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

/**
 * The days an event covers, in IST. The end is exclusive, so an event ending
 * exactly at midnight does not spill onto the next day, but a zero-length
 * entry (a deadline) still occupies the day it falls on.
 */
export function eventDays(event: TimedEvent): DayKey[] {
  const first = dayKeyOf(event.startsAt);
  const endInstant = new Date(new Date(event.endsAt).getTime() - 1);
  const last =
    new Date(event.endsAt).getTime() <= new Date(event.startsAt).getTime()
      ? first
      : dayKeyOf(endInstant);
  const days: DayKey[] = [];
  for (let day = first; day <= last && days.length < 31; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

export function groupByDay<T extends TimedEvent>(events: T[]): Map<DayKey, T[]> {
  const byDay = new Map<DayKey, T[]>();
  for (const event of events) {
    for (const day of eventDays(event)) {
      const list = byDay.get(day) ?? [];
      list.push(event);
      byDay.set(day, list);
    }
  }
  for (const list of byDay.values()) {
    list.sort(compareEvents);
  }
  return byDay;
}

/** All-day entries first, then by start time, then the longer one first. */
export function compareEvents(a: TimedEvent, b: TimedEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const start = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  if (start !== 0) return start;
  return new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime();
}

export type PlacedEvent<T> = {
  event: T;
  /** Minutes past midnight, clipped to the day. */
  top: number;
  height: number;
  column: number;
  columns: number;
};

/** Shortest block drawn in the week grid, so a 5-minute slot is still clickable. */
export const MIN_BLOCK_MINUTES = 30;

/**
 * Side-by-side columns for one day's timed events, the way a desk calendar
 * draws a clash: events that overlap share the width, and a group of
 * overlapping events is as wide as its busiest moment.
 */
export function layoutDay<T extends TimedEvent>(events: T[], day: DayKey): PlacedEvent<T>[] {
  const dayStart = istToInstant(day).getTime();
  const dayEnd = dayStart + DAY_MS;
  const items = events
    .filter((event) => !event.allDay)
    .map((event) => {
      const start = Math.max(new Date(event.startsAt).getTime(), dayStart);
      const end = Math.min(Math.max(new Date(event.endsAt).getTime(), start), dayEnd);
      const top = Math.round((start - dayStart) / 60000);
      const height = Math.max(Math.round((end - start) / 60000), MIN_BLOCK_MINUTES);
      return { event, top, height: Math.min(height, 24 * 60 - top), column: 0, columns: 1 };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);

  const placed: PlacedEvent<T>[] = [];
  let group: PlacedEvent<T>[] = [];
  let groupEnd = -1;
  let columnEnds: number[] = [];

  const closeGroup = () => {
    const width = columnEnds.length || 1;
    for (const item of group) item.columns = width;
    placed.push(...group);
    group = [];
    columnEnds = [];
  };

  for (const item of items) {
    if (group.length && item.top >= groupEnd) {
      closeGroup();
      groupEnd = -1;
    }
    let column = columnEnds.findIndex((end) => end <= item.top);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[column] = item.top + item.height;
    item.column = column;
    group.push(item);
    groupEnd = Math.max(groupEnd, item.top + item.height);
  }
  if (group.length) closeGroup();
  return placed;
}

// ---------------------------------------------------------------------------
// Formatting (always in IST)
// ---------------------------------------------------------------------------

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: CALENDAR_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatTime(instant: Date | string): string {
  return timeFormatter.format(toDate(instant)).replace(/\s?([ap])\.?m\.?/i, " $1m").toLowerCase();
}

/** "10:00 am – 12:30 pm", or "All day". */
export function formatTimeRange(event: TimedEvent): string {
  if (event.allDay) return "All day";
  if (event.startsAt === event.endsAt) return formatTime(event.startsAt);
  return `${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`;
}

/** Format a day key with no time-zone surprises: it is rendered as UTC midnight. */
function formatKey(key: DayKey, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(utcDateOfKey(key));
}

export function formatMonthTitle(key: DayKey): string {
  return formatKey(key, { month: "long", year: "numeric" });
}

export function formatWeekTitle(anchor: DayKey): string {
  const days = weekDays(anchor);
  const first = days[0];
  const last = days[6];
  if (isSameMonth(first, last)) {
    return `${formatKey(first, { day: "numeric" })} – ${formatKey(last, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return `${formatKey(first, { day: "numeric", month: "short" })} – ${formatKey(last, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function formatDayHeading(key: DayKey): string {
  return formatKey(key, { weekday: "long", day: "numeric", month: "long" });
}

export function formatShortWeekday(key: DayKey): string {
  return formatKey(key, { weekday: "short" });
}

export function formatDayNumber(key: DayKey): string {
  return String(Number(key.slice(8, 10)));
}

/** "Fri, 20 Nov 2026 · 10:00 am – 12:00 pm", for the details popover. */
export function formatEventWhen(event: TimedEvent): string {
  const startDay = dayKeyOf(event.startsAt);
  const days = eventDays(event);
  const lastDay = days[days.length - 1] ?? startDay;
  const dayLabel = (key: DayKey) => formatKey(key, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (event.allDay) {
    return lastDay === startDay ? `${dayLabel(startDay)} · All day` : `${dayLabel(startDay)} – ${dayLabel(lastDay)}`;
  }
  if (lastDay === startDay) return `${dayLabel(startDay)} · ${formatTimeRange(event)}`;
  return `${dayLabel(startDay)} ${formatTime(event.startsAt)} – ${dayLabel(lastDay)} ${formatTime(event.endsAt)}`;
}

export function hourLabel(hour: number): string {
  if (hour === 0) return "12 am";
  if (hour === 12) return "12 pm";
  return hour < 12 ? `${hour} am` : `${hour - 12} pm`;
}
