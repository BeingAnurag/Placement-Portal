import Link from "next/link";
import { CalendarClock, CheckCircle2, FileText, MessageSquareWarning } from "lucide-react";
import {
  agePhrase,
  CALENDAR_TYPE_LABELS,
  daysSince,
  FEEDBACK_TYPE_LABELS,
  formatDay,
  formatDayTime,
  personName,
  untilPhrase,
  type CalendarItem,
  type DashboardExtras,
  type FeedbackItem,
  type NocItem,
  type UpcomingDrive,
} from "./types";

const ROWS = 3;

function Card({
  title,
  icon,
  count,
  caption,
  href,
  linkLabel,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  caption?: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <article className="dash-card dash-attn">
      <header>
        <span className="dash-attn-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2>
            {title}
            {count !== undefined ? <b className={count > 0 ? "due" : ""}>{count}</b> : null}
          </h2>
          {caption ? <p>{caption}</p> : null}
        </div>
        <Link href={href} className="dash-link">
          {linkLabel}
        </Link>
      </header>
      {children}
    </article>
  );
}

function Clear({ message }: { message: string }) {
  return (
    <p className="dash-clear">
      <CheckCircle2 aria-hidden="true" />
      {message}
    </p>
  );
}

function Unavailable({ what }: { what: string }) {
  return <p className="dash-unavailable">{what} could not be loaded. Refresh to try again.</p>;
}

/** Oldest first: the request that has waited longest is the one to open next. */
function oldestFirst<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function NocCard({ panel }: { panel: DashboardExtras["noc"] }) {
  if (panel.status === "hidden") return null;
  const href = "/admin/noc-requests";

  if (panel.status === "error") {
    return (
      <Card title="Pending NOC requests" icon={<FileText />} href={href} linkLabel="Open">
        <Unavailable what="NOC requests" />
      </Card>
    );
  }

  const { metrics, pending } = panel.data;
  const queue = oldestFirst(pending);
  const oldest = queue[0];

  return (
    <Card
      title="Pending NOC requests"
      icon={<FileText />}
      count={metrics.pending}
      caption={oldest ? `Oldest has waited ${daysSince(oldest.createdAt)} days` : undefined}
      href={href}
      linkLabel="Review"
    >
      {queue.length ? (
        <ul>
          {queue.slice(0, ROWS).map((noc: NocItem) => (
            <li key={noc.id}>
              <span>
                <strong>{personName(noc.student)}</strong>
                <small>
                  {noc.company} · {noc.source === "OFF_CAMPUS" ? "Off-campus" : "On-campus"}
                </small>
              </span>
              <em>{agePhrase(noc.createdAt)}</em>
            </li>
          ))}
        </ul>
      ) : (
        <Clear message="No requests waiting for a decision." />
      )}
      {metrics.pending > ROWS ? <p className="dash-more">+{metrics.pending - ROWS} more waiting</p> : null}
    </Card>
  );
}

function QueriesCard({ panel }: { panel: DashboardExtras["queries"] }) {
  if (panel.status === "hidden") return null;
  const href = "/admin/feedbacks";

  if (panel.status === "error") {
    return (
      <Card title="Unresolved queries" icon={<MessageSquareWarning />} href={href} linkLabel="Open">
        <Unavailable what="Student queries" />
      </Card>
    );
  }

  const { pendingCount, pending } = panel.data;
  const queue = oldestFirst(pending);
  const tally = Object.entries(
    pending.reduce<Record<string, number>>((acc, item) => {
      acc[item.feedbackType] = (acc[item.feedbackType] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([type, n]) => `${n} ${(FEEDBACK_TYPE_LABELS[type] ?? type).toLowerCase()}${n === 1 ? "" : "s"}`)
    .join(" · ");

  return (
    <Card
      title="Unresolved queries"
      icon={<MessageSquareWarning />}
      count={pendingCount}
      caption={tally || undefined}
      href={href}
      linkLabel="Respond"
    >
      {queue.length ? (
        <ul>
          {queue.slice(0, ROWS).map((item: FeedbackItem) => (
            <li key={item.id}>
              <span>
                <strong>{personName(item.student)}</strong>
                <small>
                  {FEEDBACK_TYPE_LABELS[item.feedbackType] ?? item.feedbackType} · {item.subject || item.message || item.content}
                </small>
              </span>
              <em>{agePhrase(item.createdAt)}</em>
            </li>
          ))}
        </ul>
      ) : (
        <Clear message="Every student query has been answered." />
      )}
      {pendingCount > ROWS ? <p className="dash-more">+{pendingCount - ROWS} more unresolved</p> : null}
    </Card>
  );
}

type Upcoming =
  | { kind: "calendar"; at: string; item: CalendarItem }
  | { kind: "drive"; at: string; item: UpcomingDrive };

function UpcomingCard({
  calendar,
  drives,
}: {
  calendar: DashboardExtras["calendar"];
  drives: DashboardExtras["drives"];
}) {
  if (calendar.status === "hidden" && drives.status === "hidden") return null;

  const rows: Upcoming[] = [
    ...(calendar.status === "ok"
      ? calendar.data.map((item) => ({ kind: "calendar" as const, at: item.startsAt, item }))
      : []),
    ...(drives.status === "ok"
      ? drives.data.map((item) => ({ kind: "drive" as const, at: item.registrationDeadline, item }))
      : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const failed = calendar.status === "error" || drives.status === "error";
  const href = calendar.status === "hidden" ? "/admin/events" : "/admin/calendar";

  return (
    <Card
      title="Upcoming recruitment"
      icon={<CalendarClock />}
      caption="Calendar entries in the next 14 days and drive deadlines"
      href={href}
      linkLabel={calendar.status === "hidden" ? "Events" : "Calendar"}
    >
      {rows.length ? (
        <ul>
          {rows.slice(0, 4).map((row) =>
            row.kind === "calendar" ? (
              <li key={`c-${row.item.id}`}>
                <span>
                  <strong>{row.item.title}</strong>
                  <small>
                    {CALENDAR_TYPE_LABELS[row.item.type] ?? row.item.type}
                    {row.item.companyName ? ` · ${row.item.companyName}` : ""}
                  </small>
                </span>
                <em>{row.item.allDay ? formatDay(row.at) : formatDayTime(row.at)}</em>
              </li>
            ) : (
              <li key={`d-${row.item.id}`}>
                <span>
                  <strong>
                    {row.item.company} · {row.item.title}
                  </strong>
                  <small>
                    Applications close {untilPhrase(row.at)} · {row.item.applications}{" "}
                    {row.item.applications === 1 ? "applicant" : "applicants"}
                  </small>
                </span>
                <em>{formatDay(row.at)}</em>
              </li>
            ),
          )}
        </ul>
      ) : failed ? null : (
        <Clear message="Nothing scheduled and no drive closing soon." />
      )}
      {failed ? <p className="dash-unavailable">Part of this list could not be loaded.</p> : null}
    </Card>
  );
}

export function NeedsAttention({ extras }: { extras: DashboardExtras }) {
  const showAny =
    extras.noc.status !== "hidden" ||
    extras.queries.status !== "hidden" ||
    extras.calendar.status !== "hidden" ||
    extras.drives.status !== "hidden";
  if (!showAny) return null;

  return (
    <section aria-labelledby="needs-attention" className="dash-section">
      <h2 id="needs-attention" className="dash-section-title">
        Needs attention
        <span>Live: not part of the cached season figures</span>
      </h2>
      <div className="dash-attn-grid">
        <NocCard panel={extras.noc} />
        <QueriesCard panel={extras.queries} />
        <UpcomingCard calendar={extras.calendar} drives={extras.drives} />
      </div>
    </section>
  );
}
