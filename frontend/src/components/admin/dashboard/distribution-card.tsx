"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Distribution } from "./types";

type View = { key: string; tab: string; caption: string; empty: string; data: Distribution[] };

function Bars({ data, empty }: { data: Distribution[]; empty: string }) {
  if (!data.length) return <p className="dash-empty">{empty}</p>;

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const peak = Math.max(...data.map((item) => item.count));

  return (
    <ul className="dash-bars">
      {data.map((item) => (
        <li key={item.label} title={`${item.label}: ${item.count} of ${total}`}>
          <span className="dash-bars-label">{item.label}</span>
          <span className="dash-bars-track" aria-hidden="true">
            {/* Never invisible: one offer must stay visible beside a bar twenty times its size. */}
            <i style={{ width: `${Math.max(3, (item.count / peak) * 100)}%` }} />
          </span>
          <strong>{item.count}</strong>
          <span className="dash-bars-pct">{Math.round((item.count / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

/** Branch, degree, and internship breakdowns share one card; height follows the data. */
export function DistributionCard({
  placementsByBranch,
  placementsByDegree,
  internshipsByDegree,
}: {
  placementsByBranch: Distribution[];
  placementsByDegree: Distribution[];
  internshipsByDegree: Distribution[];
}) {
  const views: View[] = [
    {
      key: "branch",
      tab: "By branch",
      caption: "Full-time and PPO offers, by the branch of the student holding them",
      empty: "Branch figures appear once the season's offers are recorded.",
      data: placementsByBranch,
    },
    {
      key: "degree",
      tab: "By degree",
      caption: "Full-time and PPO offers, by degree programme",
      empty: "No placement offers recorded for this season.",
      data: placementsByDegree,
    },
    {
      key: "internships",
      tab: "Internships",
      caption: "Internship offers, by degree programme",
      empty: "No internship offers recorded for this season.",
      data: internshipsByDegree,
    },
  ];

  // Open on the first view that has something to show rather than on a blank one.
  const initial = views.find((view) => view.data.length)?.key ?? views[0].key;

  return (
    <article className="dash-card">
      <Tabs defaultValue={initial}>
        <header className="dash-card-head">
          <div>
            <h2>Placement distribution</h2>
          </div>
          <TabsList>
            {views.map((view) => (
              <TabsTrigger key={view.key} value={view.key}>
                {view.tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </header>
        {views.map((view) => (
          <TabsContent key={view.key} value={view.key}>
            <p className="dash-caption">{view.caption}</p>
            <Bars data={view.data} empty={view.empty} />
          </TabsContent>
        ))}
      </Tabs>
    </article>
  );
}
