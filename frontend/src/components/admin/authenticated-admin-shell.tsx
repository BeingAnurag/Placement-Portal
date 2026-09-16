import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin-session";
import { canAccessAdminRoute, ROUTE_PERMISSIONS } from "@/lib/permissions";
import { studentInitials } from "@/lib/student-session";

export async function AuthenticatedAdminShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const name = admin.user?.name ?? admin.session.user.name ?? "Administrator";
  const role = admin.user?.role ?? admin.session.user.role;
  const title = admin.user?.title;

  // The sidebar should only offer pages this account can actually open. Each
  // page still enforces its own permission, so this is about not sending a
  // coordinator to a link that immediately redirects them away.
  const allowedPaths = Object.keys(ROUTE_PERMISSIONS).filter((path) =>
    canAccessAdminRoute(admin.user, path),
  );

  return (
    <AdminShell admin={{ name, initials: studentInitials(name), role, title }} allowedPaths={allowedPaths}>
      {children}
    </AdminShell>
  );
}
