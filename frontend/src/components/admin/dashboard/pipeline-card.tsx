import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { ApplicationFunnel } from "./types";

type Row = { label: string; count: number; hint: string; tone: "total" | "shortlist" | "interview" | "selected" };

/**
 * Application pipeline for the season. Each row is "at this stage or later",
 * so the bars can only shrink going down. An application records only where
 * it is now, so a candidate who was shortlisted and then rejected is not
 * counted as shortlisted: every row below the first is a floor.
 */
export function PipelineCard({
  funnel,
  season,
  canRecordPlacements,
}: {
  funnel: ApplicationFunnel;
  season: number;
  canRecordPlacements: boolean;
}) {
  const rows: Row[] = [
    { label: "Applications", count: funnel.total, hint: "All applications to this season's drives", tone: "total" },
    { label: "Shortlisted or later", count: funnel.reachedShortlist, hint: "Shortlisted, interviewing, or selected", tone: "shortlist" },
    { label: "Interview or later", count: funnel.reachedInterview, hint: "Interviewing or selected", tone: "interview" },
    { label: "Selected", count: funnel.reachedSelection, hint: "Selected, including accepted and declined offers", tone: "selected" },
  ];
  const pct = (n: number) => (funnel.total > 0 ? Math.round((n / funnel.total) * 100) : 0);

  const outcomes: Array<[string, number]> = [
    ["Applied", funnel.applied],
    ["Not selected", funnel.rejected],
    ["Withdrawn", funnel.withdrawn],
    ["Offer accepted", funnel.offerAccepted],
    ["Offer declined", funnel.offerDeclined],
  ];

  return (
    <article className="dash-card">
      <header className="dash-card-head">
        <div>
          <h2>Application pipeline</h2>
          <p>Applications to {season} drives, by furthest stage reached</p>
        </div>
      </header>

      {funnel.total === 0 ? (
        <p className="dash-empty">No applications to {season} drives yet.</p>
      ) : (
        <>
          <ol className="dash-pipeline">
            {rows.map((row) => (
              <li key={row.label} className={`tone-${row.tone}`} title={row.hint}>
                <span className="dash-pipeline-label">{row.label}</span>
                <span className="dash-pipeline-track" aria-hidden="true">
                  <i style={{ width: `${row.count > 0 ? Math.max(3, pct(row.count)) : 0}%` }} />
                </span>
                <strong>{row.count}</strong>
                <span className="dash-pipeline-pct">{pct(row.count)}%</span>
              </li>
            ))}
          </ol>

          <dl className="dash-outcomes" aria-label="Where applications are now">
            {outcomes.map(([label, count]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>

          {funnel.selectedWithoutOffer > 0 ? (
            <p className="dash-note warn">
              <AlertCircle aria-hidden="true" />
              <span>
                {funnel.selectedWithoutOffer} selected{" "}
                {funnel.selectedWithoutOffer === 1 ? "student has" : "students have"} no offer on file from that company.{" "}
                {canRecordPlacements ? <Link href="/admin/placement-records/add">Record placements</Link> : null}
              </span>
            </p>
          ) : null}

          <p className="dash-foot">
            Each application records only its current stage, so a candidate shortlisted and later rejected is not
            counted as shortlisted. Lower rows are a minimum.
          </p>
        </>
      )}
    </article>
  );
}
