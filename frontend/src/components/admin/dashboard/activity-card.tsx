import Link from "next/link";
import { Activity } from "lucide-react";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import type { ApplicationStatus } from "@prisma/client";
import {
  agePhrase,
  FEEDBACK_TYPE_LABELS,
  personName,
  type AdminOverview,
  type DashboardExtras,
} from "./types";

type Tone = "blue" | "purple" | "amber" | "green" | "red" | "gray";

type Entry = {
  key: string;
  at: string;
  title: string;
  detail: string;
  label: string;
  tone: Tone;
  href: string;
};

const APPLICATION_TONES: Partial<Record<string, Tone>> = {
  APPLIED: "blue",
  SHORTLISTED: "purple",
  INTERVIEW: "amber",
  SELECTED: "green",
  OFFER_ACCEPTED: "green",
  OFFER_DECLINED: "gray",
  REJECTED: "red",
  WITHDRAWN: "gray",
};

const NOC_TONES: Record<string, Tone> = { PENDING: "amber", APPROVED: "green", REJECTED: "red" };
const NOC_LABELS: Record<string, string> = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };

function buildEntries(overview: AdminOverview, extras: DashboardExtras): Entry[] {
  const entries: Entry[] = overview.recentApplications
    .filter((application) => application.updatedAt)
    .map((application) => ({
      key: `app-${application.id}`,
      at: application.updatedAt as string,
      title: application.student,
      detail: `${application.company} · ${application.role}`,
      label: APPLICATION_STATUS_LABELS[application.status as ApplicationStatus] ?? application.status,
      tone: APPLICATION_TONES[application.status] ?? "gray",
      href: "/admin/applications",
    }));

  if (extras.noc.status === "ok") {
    for (const noc of extras.noc.data.recent) {
      entries.push({
        key: `noc-${noc.id}`,
        at: noc.createdAt,
        title: personName(noc.student),
        detail: `NOC request · ${noc.company}`,
        label: NOC_LABELS[noc.status] ?? noc.status,
        tone: NOC_TONES[noc.status] ?? "gray",
        href: "/admin/noc-requests",
      });
    }
  }

  if (extras.queries.status === "ok") {
    for (const item of extras.queries.data.recent) {
      entries.push({
        key: `fb-${item.id}`,
        at: item.createdAt,
        title: personName(item.student),
        detail: `${FEEDBACK_TYPE_LABELS[item.feedbackType] ?? item.feedbackType} · ${item.subject || item.message || item.content}`,
        label: item.resolved ? "Resolved" : "Open",
        tone: item.resolved ? "green" : "amber",
        href: "/admin/feedbacks",
      });
    }
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}

/**
 * One feed across what students did lately. Applications are the season's;
 * NOC requests and queries are portal-wide, and the caption says so rather
 * than letting the list imply they share a scope.
 */
export function ActivityCard({ overview, extras }: { overview: AdminOverview; extras: DashboardExtras }) {
  const entries = buildEntries(overview, extras);

  return (
    <section className="dash-card" aria-labelledby="recent-activity">
      <header className="dash-card-head">
        <div>
          <h2 id="recent-activity">Recent activity</h2>
          <p>
            Application changes for {overview.season}. NOC requests and queries from every season.
          </p>
        </div>
      </header>

      {entries.length ? (
        <ul className="dash-activity">
          {entries.map((entry) => (
            <li key={entry.key}>
              <Link href={entry.href}>
                <span className="dash-activity-main">
                  <strong>{entry.title}</strong>
                  <small>{entry.detail}</small>
                </span>
                <span className={`dash-pill tone-${entry.tone}`}>{entry.label}</span>
                <em>{agePhrase(entry.at)}</em>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="admin-empty compact">
          <Activity />
          <h2>Nothing yet</h2>
          <p>Applications, NOC requests and student queries will appear here.</p>
        </div>
      )}
    </section>
  );
}
