import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { AdminDashboard, type AdminOverview, type DashboardExtras } from "@/components/admin/admin-dashboard";
import type {
  CalendarItem,
  FeedbackItem,
  NocItem,
  NocMetrics,
  Panel,
  QuickActionKey,
  UpcomingDrive,
} from "@/components/admin/dashboard/types";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import {
  hasPermission,
  PERM_ANALYTICS_VIEW,
  PERM_ANNOUNCEMENTS_CREATE,
  PERM_APPLICATIONS_UPDATE,
  PERM_CALENDAR_MANAGE,
  PERM_CALENDAR_VIEW,
  PERM_COMPANIES_CREATE,
  PERM_FEEDBACK_VIEW,
  PERM_JOBS_CREATE,
  PERM_JOBS_VIEW,
  PERM_NOC_APPROVE,
  PERM_NOC_VIEW,
  PERM_PLACEMENT_RECORDS_CREATE,
  type PermissionKey,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

const CALENDAR_WINDOW_DAYS = 14;

/**
 * Loads one dashboard block on its own. A viewer without the permission gets
 * `hidden`, and a failing endpoint gets `error`: neither may take the rest of
 * the page down with it.
 */
async function panel<T>(allowed: boolean, label: string, load: () => Promise<T>): Promise<Panel<T>> {
  if (!allowed) return { status: "hidden" };
  try {
    return { status: "ok", data: await load() };
  } catch (error) {
    console.error(`Dashboard: failed to load ${label}`, error);
    return { status: "error" };
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { user } = await requirePermission(PERM_ANALYTICS_VIEW);
  const subject = { ...user, email: user.email };
  const can = (permission: PermissionKey) => hasPermission(subject, permission);

  const { season } = await searchParams;
  const requested = Number.parseInt(season ?? "", 10);
  const query = Number.isFinite(requested) ? `?batch=${requested}` : "";

  // The aggregation belongs to the backend: the same figures feed any future
  // report, and rebuilding them here is how the application export drifted.
  let overview: AdminOverview | null = null;
  let backendError: string | null = null;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + CALENDAR_WINDOW_DAYS * 86_400_000);

  // FACULTY holds noc.view but is only ever shown approved requests, and the
  // backend reports zero pending for them, so a "pending" panel would mislead.
  const canReviewNocs = can(PERM_NOC_VIEW) && user.role !== "FACULTY";

  const [overviewResult, noc, queries, calendar, drives] = await Promise.all([
    backendFetch<AdminOverview>(`/api/v1/analytics/admin/overview${query}`, { cache: "no-store" }).then(
      (value) => ({ value }),
      (error: unknown) => {
        console.error("Failed to load the placement overview from the backend", error);
        return { error };
      },
    ),
    panel(canReviewNocs, "NOC requests", async () => {
      const [metrics, pending, recent] = await Promise.all([
        backendFetch<NocMetrics>("/api/v1/noc/admin/metrics", { cache: "no-store" }),
        backendFetch<NocItem[]>("/api/v1/noc/admin?status_filter=PENDING&limit=500", { cache: "no-store" }),
        backendFetch<NocItem[]>("/api/v1/noc/admin?limit=5", { cache: "no-store" }),
      ]);
      return { metrics, pending, recent };
    }),
    panel(can(PERM_FEEDBACK_VIEW), "student queries", async () => {
      const [metrics, pending, recent] = await Promise.all([
        backendFetch<{ pending: number }>("/api/v1/feedback/admin/metrics", { cache: "no-store" }),
        backendFetch<FeedbackItem[]>("/api/v1/feedback/admin?status_filter=PENDING&limit=500", {
          cache: "no-store",
        }),
        backendFetch<FeedbackItem[]>("/api/v1/feedback/admin?limit=5", { cache: "no-store" }),
      ]);
      return { pendingCount: metrics.pending, pending, recent };
    }),
    panel(can(PERM_CALENDAR_VIEW), "calendar", () =>
      backendFetch<CalendarItem[]>(
        `/api/v1/calendar/events?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(windowEnd.toISOString())}`,
        { cache: "no-store" },
      ),
    ),
    panel(can(PERM_JOBS_VIEW), "upcoming drives", () =>
      backendFetch<UpcomingDrive[]>("/api/v1/analytics/admin/upcoming-drives?limit=5", { cache: "no-store" }),
    ),
  ]);

  if ("value" in overviewResult) {
    overview = overviewResult.value;
  } else {
    backendError = "Placement analytics could not be loaded. The API service is unreachable.";
  }

  const shortcuts: Array<[QuickActionKey, PermissionKey]> = [
    ["record-placement", PERM_PLACEMENT_RECORDS_CREATE],
    ["add-event", PERM_JOBS_CREATE],
    ["announce", PERM_ANNOUNCEMENTS_CREATE],
    ["add-company", PERM_COMPANIES_CREATE],
    ["calendar", PERM_CALENDAR_MANAGE],
    ["review-nocs", PERM_NOC_APPROVE],
    ["review-applications", PERM_APPLICATIONS_UPDATE],
  ];

  const extras: DashboardExtras = {
    noc,
    queries,
    calendar,
    drives,
    actions: shortcuts.filter(([, permission]) => can(permission)).map(([key]) => key),
    canRecordPlacements: can(PERM_PLACEMENT_RECORDS_CREATE),
  };

  return (
    <AuthenticatedAdminShell>
      <AdminDashboard overview={overview} extras={extras} backendError={backendError} />
    </AuthenticatedAdminShell>
  );
}
