import { formatRupees, formatStipend } from "@/lib/offer-schema";
import type { AdminOverview, AmountStats } from "./types";

type Line = { label: string; stats: AmountStats; monthly?: boolean; emphasis?: boolean };

/**
 * One table for every package statistic, in place of four near-empty cards.
 * "Offers" counts only offers that carry an amount: an offer recorded without
 * a CTC is left out of the maths rather than counted as zero.
 */
export function PackagesCard({ packages, wide }: { packages: AdminOverview["packages"]; wide?: boolean }) {
  const lines: Line[] = [
    { label: "Full-time", stats: packages.placement },
    { label: "PPO", stats: packages.ppo },
    { label: "All placements", stats: packages.combined, emphasis: true },
    { label: "Internships", stats: packages.internship, monthly: true },
  ];
  const anyData = lines.some((line) => line.stats.count > 0);

  return (
    <article className={`dash-card${wide ? " wide" : ""}`}>
      <header className="dash-card-head">
        <div>
          <h2>Package statistics</h2>
          <p>CTC per year for placements · stipend per month for internships</p>
        </div>
      </header>

      {anyData ? (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col" title="Offers that carry a recorded amount">
                  Offers
                </th>
                <th scope="col">Median</th>
                <th scope="col">Average</th>
                <th scope="col">Highest</th>
                <th scope="col">Lowest</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(({ label, stats, monthly, emphasis }) => {
                const format = monthly ? formatStipend : formatRupees;
                return (
                  <tr key={label} className={emphasis ? "emphasis" : undefined}>
                    <th scope="row">{label}</th>
                    <td>{stats.count}</td>
                    <td>{format(stats.median)}</td>
                    <td>{format(stats.average)}</td>
                    <td>{format(stats.highest)}</td>
                    <td>{format(stats.lowest)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="dash-empty">No package has been recorded for this season yet.</p>
      )}
    </article>
  );
}
