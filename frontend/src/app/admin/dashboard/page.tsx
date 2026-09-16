import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { AdminDashboard, type AdminOverview } from "@/components/admin/admin-dashboard";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { PERM_ANALYTICS_VIEW } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requirePermission(PERM_ANALYTICS_VIEW);

  const { season } = await searchParams;
  const requested = Number.parseInt(season ?? "", 10);
  const query = Number.isFinite(requested) ? `?batch=${requested}` : "";

  // The aggregation belongs to the backend: the same figures feed any future
  // report, and rebuilding them here is how the application export drifted.
  let overview: AdminOverview | null = null;
  let backendError: string | null = null;

  try {
    overview = await backendFetch<AdminOverview>(`/api/v1/analytics/admin/overview${query}`, {
      cache: "no-store",
    });
  } catch (error) {
    console.error("Failed to load the placement overview from the backend", error);
    backendError = "Placement analytics could not be loaded. The API service is unreachable.";
  }

  return (
    <AuthenticatedAdminShell>
      <AdminDashboard overview={overview} backendError={backendError} />
    </AuthenticatedAdminShell>
  );
}
