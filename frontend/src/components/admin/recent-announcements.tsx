import Link from "next/link";
import { Megaphone } from "lucide-react";

export type RecentAnnouncementItem = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  companyName: string | null;
  tags: string[];
  createdAt: string;
};

const dateOnly = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * What the composer has produced lately. Editing, withdrawing, and deleting
 * all live on the "Active & drafts" screen, so this stays a read-only list.
 */
export function RecentAnnouncements({
  heading,
  items,
}: {
  heading: string;
  items: RecentAnnouncementItem[];
}) {
  return (
    <section className="recent-admin" style={{ marginTop: 18 }}>
      <header>
        <div>
          <h2>{heading}</h2>
          <p>Manage, edit, or withdraw any of these on the Active &amp; drafts screen</p>
        </div>
        <Link href="/admin/announcements" className="recent-admin-link">
          Open
        </Link>
      </header>
      {items.length ? (
        items.map((item) => (
          <div key={item.id}>
            <i />
            <span>
              <strong>{item.title}</strong>
              <small>
                {item.status === "DRAFT" ? "Draft" : "Active"}
                {item.companyName ? ` · ${item.companyName}` : ""}
                {item.tags.length ? ` · ${item.tags.join(", ")}` : ""} ·{" "}
                {dateOnly.format(new Date(item.createdAt))}
              </small>
            </span>
          </div>
        ))
      ) : (
        <div className="admin-empty compact">
          <Megaphone />
          <h2>Nothing written yet</h2>
          <p>The announcements you write above appear here.</p>
        </div>
      )}
    </section>
  );
}
