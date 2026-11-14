import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { CalendarView } from "@/components/calendar/calendar-view";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import type { BackendCalendarEvent, BackendCalendarOptions } from "@/lib/backend-types";
import { parseCalendarParams, rangeQuery } from "@/lib/calendar-utils";
import { hasPermission, PERM_CALENDAR_MANAGE, PERM_CALENDAR_VIEW } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { user } = await requirePermission(PERM_CALENDAR_VIEW);
  // Faculty hold calendar.view only: they see the shared plan but get no
  // controls to change it.
  const canManage = hasPermission(user, PERM_CALENDAR_MANAGE);
  const { view, anchor } = parseCalendarParams(await searchParams);
  const { from, to } = rangeQuery(view, anchor);

  let events: BackendCalendarEvent[] = [];
  let options: BackendCalendarOptions | null = null;
  let backendError: string | null = null;

  try {
    const query = new URLSearchParams({ from, to });
    [events, options] = await Promise.all([
      backendFetch<BackendCalendarEvent[]>(`/api/v1/calendar/events?${query}`, { cache: "no-store" }),
      canManage
        ? backendFetch<BackendCalendarOptions>("/api/v1/calendar/options", { cache: "no-store" })
        : Promise.resolve(null),
    ]);
  } catch (error) {
    console.error("Failed to load the placement calendar from the backend", error);
    backendError = "The calendar could not be loaded. The API service is unreachable.";
  }

  return (
    <AuthenticatedAdminShell>
      <div className="admin-page">
        <section className="admin-heading mb-5">
          <div>
            <span className="eyebrow">Placement calendar</span>
            <h1>Calendar</h1>
            <p>
              Company visits, tests and interview slots in one place. Assign a POC so the team knows who owns
              each company, and choose whether students can see an entry.
            </p>
          </div>
        </section>
        <CalendarView
          mode="staff"
          view={view}
          anchor={anchor}
          events={events}
          options={options}
          currentUserId={user.id}
          canCreateShared={canManage}
          backendError={backendError}
        />
      </div>
    </AuthenticatedAdminShell>
  );
}
