import { InterviewExperiencesView, type InterviewExperienceItem } from "@/components/interview-experiences/interview-experiences-view";
import { AuthenticatedPortalShell } from "@/components/layout/authenticated-portal-shell";
import { backendFetch } from "@/lib/api-client";
import { requireStudent } from "@/lib/student-session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireStudent();

  let approved: InterviewExperienceItem[] = [];
  let mine: InterviewExperienceItem[] = [];
  let companies: string[] = [];

  try {
    [approved, mine, companies] = await Promise.all([
      backendFetch<InterviewExperienceItem[]>("/api/v1/interview-experiences"),
      backendFetch<InterviewExperienceItem[]>("/api/v1/interview-experiences/mine"),
      backendFetch<string[]>("/api/v1/interview-experiences/companies"),
    ]);
  } catch (err) {
    console.error("Failed to fetch interview experiences", err);
  }

  return (
    <AuthenticatedPortalShell>
      <InterviewExperiencesView approvedExperiences={approved} myExperiences={mine} companies={companies} />
    </AuthenticatedPortalShell>
  );
}
