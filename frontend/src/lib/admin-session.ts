import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminEmail } from "@/lib/auth-access";
import {
  firstAccessibleAdminRoute,
  hasAnyAdminPermission,
  hasPermission,
  type PermissionKey,
} from "@/lib/permissions";

export const requireAdmin = cache(async () => {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!hasAnyAdminPermission(session.user)) {
    redirect("/dashboard");
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.isActive) redirect("/login");

  return { session, user };
});

export const requirePermission = cache(async (permission: PermissionKey) => {
  return requireAnyPermission(permission);
});

/**
 * For screens reachable by more than one grant — a read permission or the
 * manage permission that implies it.
 */
export const requireAnyPermission = cache(async (...permissions: PermissionKey[]) => {
  const { session, user } = await requireAdmin();

  const isBootstrapAdmin = isAdminEmail(user.email);
  if (isBootstrapAdmin || user.role === "SUPER_ADMIN") {
    return { session, user };
  }

  const subject = { ...user, email: user.email };
  if (!permissions.some((permission) => hasPermission(subject, permission))) {
    // Sending them to /admin/dashboard would loop forever for an account that
    // cannot open the dashboard either.
    redirect(firstAccessibleAdminRoute(subject) ?? "/dashboard");
  }

  return { session, user };
});
