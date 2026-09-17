import { NextRequest, NextResponse } from "next/server";
import { backendAuthHeader, backendBaseUrl } from "@/lib/api-client";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/student-session";
import { requirePermission } from "@/lib/admin-session";
import { PERM_NOC_VIEW } from "@/lib/permissions";

// NOC certificates are stored via the same local/Cloudinary storage as
// resumes. When Cloudinary isn't configured, NocRequest.documentUrl holds a
// backend-relative path like "/api/v1/uploads/files/noc_docs/xyz.pdf" rather
// than a browser-reachable URL, so it must be proxied the same way
// frontend/src/app/api/resumes/[id]/route.ts proxies resume files.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return new NextResponse("NOC request ID is required", { status: 400 });
  }

  // Authorize: either the owning student, or a staff account that may read NOC
  // requests. Reaching the admin portal at all is NOT sufficient — that check
  // was permission-blind and skipped the ownership branch below.
  let isAuthorized = false;
  let currentUserId: string | undefined;

  try {
    await requirePermission(PERM_NOC_VIEW);
    isAuthorized = true;
  } catch {
    try {
      const student = await requireStudent();
      if (student?.user) {
        currentUserId = student.user.id;
      }
    } catch {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const noc = await db.nocRequest.findUnique({ where: { id } });
  if (!noc || !noc.documentUrl) {
    return new NextResponse("NOC document not found", { status: 404 });
  }

  if (!isAuthorized && noc.userId !== currentUserId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // External link (Cloudinary or public document)
  if (noc.documentUrl.startsWith("http://") || noc.documentUrl.startsWith("https://")) {
    return NextResponse.redirect(noc.documentUrl);
  }

  // Local storage: stream from the backend, which owns the file on disk.
  try {
    const backendUrl = `${backendBaseUrl()}${noc.documentUrl}`;
    const res = await fetch(backendUrl, {
      headers: await backendAuthHeader(),
    });

    if (!res.ok) {
      return new NextResponse("NOC document could not be retrieved", { status: 502 });
    }

    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="NOC-${noc.company.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf"`,
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    console.error("Failed to stream NOC document from backend", error);
    return new NextResponse("NOC document could not be retrieved", { status: 502 });
  }
}
