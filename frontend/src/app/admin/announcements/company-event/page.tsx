import Link from "next/link";
import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import {
  AnnouncementComposer,
  type ComposerCompany,
  type ComposerEvent,
} from "@/components/admin/announcement-composer";
import { RecentAnnouncements } from "@/components/admin/recent-announcements";
import { requirePermission } from "@/lib/admin-session";
import { PERM_ANNOUNCEMENTS_MANAGE } from "@/lib/permissions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePermission(PERM_ANNOUNCEMENTS_MANAGE);

  const [companies, jobs, recent] = await Promise.all([
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.jobProfile.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, companyId: true, batch: true },
    }),
    db.announcement.findMany({
      where: { category: "COMPANY_EVENT" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { company: { select: { name: true } } },
    }),
  ]);

  const events: ComposerEvent[] = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    companyId: job.companyId,
    batch: job.batch,
  }));
  const companyOptions: ComposerCompany[] = companies.map((company) => ({
    id: company.id,
    name: company.name,
  }));
  // Only seasons that have a drive: a company event announcement is about one.
  const seasons = [...new Set(jobs.map((job) => job.batch))].sort((a, b) => b - a);

  return (
    <AuthenticatedAdminShell>
      <div className="admin-page">
        <section className="admin-heading">
          <div>
            <span className="eyebrow">Communications &amp; drives</span>
            <h1>Company event announcement</h1>
            <p>A drive update tied to a recruiting company: shortlists, schedules, and results.</p>
          </div>
          <Link href="/admin/announcements">Active &amp; drafts</Link>
        </section>

        <AnnouncementComposer
          category="COMPANY_EVENT"
          companies={companyOptions}
          events={events}
          seasons={seasons}
        />

        <RecentAnnouncements
          heading="Recent company event announcements"
          items={recent.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
            companyName: item.company?.name ?? null,
            tags: item.tags,
            createdAt: item.createdAt.toISOString(),
          }))}
        />
      </div>
    </AuthenticatedAdminShell>
  );
}
