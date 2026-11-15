import type { Recruiter } from "./types";

/** Companies ranked by counted offers, with the placement/internship split. */
export function RecruitersCard({ recruiters }: { recruiters: Recruiter[] }) {
  const peak = recruiters[0]?.count || 1;

  return (
    <article className="dash-card">
      <header className="dash-card-head">
        <div>
          <h2>Top recruiters</h2>
          <p>Companies by offers made this season, placements and internships</p>
        </div>
      </header>

      {recruiters.length ? (
        <ol className="dash-rank">
          {recruiters.map((item, index) => (
            <li key={item.label}>
              <span className="dash-rank-n">{index + 1}</span>
              <span className="dash-rank-name">
                <strong>{item.label}</strong>
                <small>
                  {item.placements} full-time/PPO · {item.internships}{" "}
                  {item.internships === 1 ? "internship" : "internships"}
                </small>
              </span>
              <span className="dash-bars-track" aria-hidden="true">
                <i style={{ width: `${Math.max(3, (item.count / peak) * 100)}%` }} />
              </span>
              <strong className="dash-rank-count">{item.count}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dash-empty">No offers recorded for this season.</p>
      )}
    </article>
  );
}
