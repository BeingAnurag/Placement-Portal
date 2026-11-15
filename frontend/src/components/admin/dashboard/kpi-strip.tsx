import Link from "next/link";
import { formatRupees, formatStipend } from "@/lib/offer-schema";
import type { AdminOverview } from "./types";

type Kpi = {
  label: string;
  value: string;
  detail: string;
  /** Optional 0-100 fill for a thin progress rule under the value. */
  progress?: number;
  href?: string;
  tone?: "warn";
};

function buildKpis(overview: AdminOverview): Kpi[] {
  const { totals, packages, live } = overview;
  const pastDeadline = Math.max(0, totals.activeJobs - live.openDrives);

  return [
    {
      label: "Students placed",
      value: `${totals.placedStudents} / ${totals.seasonStudents}`,
      detail: `${totals.placementRate}% of the ${overview.season} batch · ${totals.placements} full-time or PPO ${
        totals.placements === 1 ? "offer" : "offers"
      }`,
      progress: totals.placementRate,
    },
    {
      label: "Median package",
      value: formatRupees(packages.combined.median),
      detail: packages.combined.count
        ? `Average ${formatRupees(packages.combined.average)} · ${packages.combined.count} with a recorded CTC`
        : "No full-time or PPO CTC recorded",
    },
    {
      label: "Highest package",
      value: formatRupees(packages.combined.highest),
      detail: packages.combined.count
        ? `Lowest ${formatRupees(packages.combined.lowest)} · ${totals.placementRecruiters} ${
            totals.placementRecruiters === 1 ? "recruiter" : "recruiters"
          } hiring`
        : "Appears once a CTC is recorded",
    },
    {
      label: "Internship offers",
      value: String(totals.internships),
      detail: packages.internship.count
        ? `Median ${formatStipend(packages.internship.median)}`
        : "No stipend recorded",
    },
    {
      label: "Drives open",
      value: String(live.openDrives),
      detail:
        pastDeadline > 0
          ? `${pastDeadline} more marked active but past deadline`
          : `${totals.companies} companies on record`,
      href: "/admin/events",
      tone: pastDeadline > 0 && live.openDrives === 0 ? "warn" : undefined,
    },
  ];
}

export function KpiStrip({ overview }: { overview: AdminOverview }) {
  return (
    <section className="dash-kpis" aria-label="Season summary">
      {buildKpis(overview).map((kpi) => {
        const body = (
          <>
            <small>{kpi.label}</small>
            <strong>{kpi.value}</strong>
            {kpi.progress !== undefined ? (
              <span className="dash-kpi-rule" aria-hidden="true">
                <i style={{ width: `${Math.min(100, Math.max(0, kpi.progress))}%` }} />
              </span>
            ) : null}
            <span className={`dash-kpi-detail${kpi.tone === "warn" ? " warn" : ""}`}>{kpi.detail}</span>
          </>
        );
        return kpi.href ? (
          <Link key={kpi.label} href={kpi.href} className="dash-kpi link">
            {body}
          </Link>
        ) : (
          <div key={kpi.label} className="dash-kpi">
            {body}
          </div>
        );
      })}
    </section>
  );
}
