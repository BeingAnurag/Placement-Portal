import { NextRequest, NextResponse } from "next/server";
import { backendAuthHeader, backendBaseUrl } from "@/lib/api-client";
import { auth } from "@/lib/auth";
import { hasPermission, PERM_APPLICATIONS_MANAGE } from "@/lib/permissions";

// The CSV is produced by GET /api/v1/applications/admin/export, which owns the
// query and adds the Resume Label column. This handler exists because a browser
// download cannot attach the session's bearer token by itself; FastAPI's
// require_admin still authorizes the request on the other side.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (!hasPermission(session.user, PERM_APPLICATIONS_MANAGE)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const incoming = request.nextUrl.searchParams;
  const query = new URLSearchParams();
  for (const key of ["job_id", "status", "branch", "batch", "search"]) {
    const value = incoming.get(key);
    if (value && value !== "ALL") query.set(key, value);
  }

  const suffix = query.size ? `?${query}` : "";

  try {
    const res = await fetch(`${backendBaseUrl()}/api/v1/applications/admin/export${suffix}`, {
      headers: await backendAuthHeader(),
      cache: "no-store",
    });

    if (!res.ok) {
      return new NextResponse("The export could not be generated.", { status: 502 });
    }

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(await res.arrayBuffer(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="applications_export_${today}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch the application export from the backend", error);
    return new NextResponse("The export could not be generated.", { status: 502 });
  }
}
