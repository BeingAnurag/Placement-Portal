import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  canAccessAdminRoute,
  firstAccessibleAdminRoute,
  hasAnyAdminPermission,
} from "@/lib/permissions";

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  if (pathname.startsWith("/admin")) {
    if (!hasAnyAdminPermission(session.user)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (!canAccessAdminRoute(session.user, pathname)) {
      // Never redirect to /admin/dashboard unconditionally: an account that
      // cannot open the dashboard would bounce between the two forever.
      const fallback = firstAccessibleAdminRoute(session.user) ?? "/dashboard";
      return NextResponse.redirect(new URL(fallback, request.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/account/:path*",
    "/dashboard/:path*",
    "/company-events/:path*",
    "/applications/:path*",
    "/feedback/:path*",
    "/profile/:path*",
    "/forms/:path*",
    "/contact/:path*",
    "/team/:path*",
    "/admin/:path*",
  ],
};
