"use client";

import { CalendarX2, MapPin, Users, Video } from "lucide-react";
import { cn } from "cn";
import type { BackendCalendarEvent } from "@/lib/backend-types";
import {
  formatDayHeading,
  formatTimeRange,
  groupByDay,
  todayKey,
  visibleDays,
  type DayKey,
} from "@/lib/calendar-utils";
import { EVENT_TYPE_LABELS } from "@/lib/calendar-schema";
import { EVENT_TYPE_STYLES } from "./calendar-styles";

export function AgendaList({
  anchor,
  events,
  onSelectEvent,
  emptyMessage,
}: {
  anchor: DayKey;
  events: BackendCalendarEvent[];
  onSelectEvent: (event: BackendCalendarEvent) => void;
  emptyMessage: string;
}) {
  const { start, end } = visibleDays("agenda", anchor);
  const byDay = groupByDay(events);
  const days = [...byDay.keys()].filter((day) => day >= start && day < end).sort();
  const today = todayKey();

  if (!days.length) {
    return (
      <div className="grid place-items-center gap-2 rounded-xl border bg-card px-6 py-16 text-center">
        <CalendarX2 className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {days.map((day) => (
        <section key={day} className="overflow-hidden rounded-xl border bg-card">
          <h3
            className={cn(
              "border-b bg-[var(--surface-alt)] px-4 py-2 text-sm font-semibold",
              day === today && "text-[var(--blue)]",
              day < today && "text-muted-foreground",
            )}
          >
            {formatDayHeading(day)}
            {day === today ? " · Today" : ""}
          </h3>
          <ul className="divide-y">
            {(byDay.get(day) ?? []).map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/50"
                >
                  <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", EVENT_TYPE_STYLES[event.type].dot)} />
                  <span className="w-28 shrink-0 text-sm text-muted-foreground tabular-nums sm:w-36">
                    {formatTimeRange(event)}
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate font-medium">{event.title}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{EVENT_TYPE_LABELS[event.type]}</span>
                      {event.companyName ? <span>{event.companyName}</span> : null}
                      {event.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {event.location}
                        </span>
                      ) : null}
                      {event.meetingLink ? (
                        <span className="inline-flex items-center gap-1">
                          <Video className="size-3" />
                          Online
                        </span>
                      ) : null}
                      {event.pocs.length ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" />
                          POC: {event.pocs.map((poc) => poc.name ?? poc.email).join(", ")}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
