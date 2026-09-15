"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { PERM_INTERVIEW_EXPERIENCES_MANAGE } from "@/lib/permissions";

export type InterviewExperienceActionResult = { error?: string; success?: string };

export async function approveInterviewExperienceAction(formData: FormData): Promise<InterviewExperienceActionResult> {
  await requirePermission(PERM_INTERVIEW_EXPERIENCES_MANAGE);

  const experienceId = formData.get("experienceId");
  if (typeof experienceId !== "string" || !experienceId) {
    return { error: "Invalid interview experience ID." };
  }
  const reviewNote = formData.get("reviewNote");

  try {
    await backendFetch(`/api/v1/interview-experiences/admin/${experienceId}/approve`, {
      method: "POST",
      body: JSON.stringify({ reviewNote: reviewNote || undefined }),
    });
  } catch (err) {
    console.error("Failed to approve interview experience", err);
    return { error: err instanceof Error ? err.message : "Failed to approve submission." };
  }

  revalidatePath("/admin/interview-experiences");
  revalidatePath("/interview-experiences");
  return { success: "Interview experience approved and published." };
}

export async function rejectInterviewExperienceAction(formData: FormData): Promise<InterviewExperienceActionResult> {
  await requirePermission(PERM_INTERVIEW_EXPERIENCES_MANAGE);

  const experienceId = formData.get("experienceId");
  if (typeof experienceId !== "string" || !experienceId) {
    return { error: "Invalid interview experience ID." };
  }
  const reviewNote = formData.get("reviewNote");

  try {
    await backendFetch(`/api/v1/interview-experiences/admin/${experienceId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reviewNote: reviewNote || undefined }),
    });
  } catch (err) {
    console.error("Failed to reject interview experience", err);
    return { error: err instanceof Error ? err.message : "Failed to reject submission." };
  }

  revalidatePath("/admin/interview-experiences");
  revalidatePath("/interview-experiences");
  return { success: "Interview experience rejected." };
}

export async function deleteInterviewExperienceAction(formData: FormData): Promise<InterviewExperienceActionResult> {
  await requirePermission(PERM_INTERVIEW_EXPERIENCES_MANAGE);

  const experienceId = formData.get("experienceId");
  if (typeof experienceId !== "string" || !experienceId) {
    return { error: "Invalid interview experience ID." };
  }

  try {
    await backendFetch(`/api/v1/interview-experiences/admin/${experienceId}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.error("Failed to delete interview experience", err);
    return { error: err instanceof Error ? err.message : "Failed to delete submission." };
  }

  revalidatePath("/admin/interview-experiences");
  revalidatePath("/interview-experiences");
  return { success: "Interview experience deleted." };
}
