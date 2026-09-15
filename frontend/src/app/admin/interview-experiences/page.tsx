import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import {
  InterviewExperiencesManager,
  type AdminInterviewExperienceItem,
} from "@/components/admin/interview-experiences-manager";
import { requirePermission } from "@/lib/admin-session";
import { backendFetch } from "@/lib/api-client";
import { PERM_INTERVIEW_EXPERIENCES_MANAGE } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePermission(PERM_INTERVIEW_EXPERIENCES_MANAGE);

  let items: AdminInterviewExperienceItem[] = [];
  try {
    items = await backendFetch<AdminInterviewExperienceItem[]>("/api/v1/interview-experiences/admin");
  } catch (err) {
    console.error("Failed to fetch interview experiences for admin", err);
  }

  return (
    <AuthenticatedAdminShell>
      <InterviewExperiencesManager experiences={items} />
    </AuthenticatedAdminShell>
  );
}
