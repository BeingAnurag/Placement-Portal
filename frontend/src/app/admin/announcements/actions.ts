"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { PERM_ANNOUNCEMENTS_MANAGE } from "@/lib/permissions";
import {
  announcementDeleteSchema,
  announcementFormSchema,
  announcementStatusSchema,
} from "@/lib/announcement-schema";
import type { AnnouncementCategory, AnnouncementStatus } from "@prisma/client";

export type AnnouncementActionResult = { error?: string; success?: string };

export async function saveAnnouncementAction(
  formData: FormData,
): Promise<AnnouncementActionResult> {
  const { user } = await requirePermission(PERM_ANNOUNCEMENTS_MANAGE);

  const rawTags = formData.get("tags");
  let tags: string[] = [];
  if (typeof rawTags === "string" && rawTags.trim()) {
    try {
      const parsedTags = JSON.parse(rawTags);
      tags = Array.isArray(parsedTags) ? parsedTags : rawTags.split(",");
    } catch {
      tags = rawTags.split(",");
    }
  }

  const parsed = announcementFormSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    content: formData.get("content"),
    category: formData.get("category"),
    status: formData.get("status") || undefined,
    companyId: formData.get("companyId") || undefined,
    tags,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please check announcement details.",
    };
  }

  const id = parsed.data.id || undefined;

  try {
    try {
      const body = JSON.stringify({
        title: parsed.data.title,
        content: parsed.data.content,
        category: parsed.data.category,
        status: parsed.data.status,
        companyId: parsed.data.companyId,
        tags: parsed.data.tags,
      });

      if (id) {
        await backendFetch(`/api/v1/announcements/${id}`, { method: "PATCH", body });
      } else {
        await backendFetch("/api/v1/announcements", { method: "POST", body });
      }
    } catch {
      // Resilient fallback to direct Prisma operations
      const data = {
        title: parsed.data.title,
        content: parsed.data.content,
        category: parsed.data.category as AnnouncementCategory,
        status: parsed.data.status as AnnouncementStatus,
        companyId: parsed.data.companyId ?? null,
        tags: parsed.data.tags,
      };

      if (id) {
        // `publishedAt` marks the first time students could see it, so
        // re-publishing a withdrawn announcement keeps the original date.
        const existing = await db.announcement.findUnique({
          where: { id },
          select: { publishedAt: true },
        });
        if (!existing) {
          return { error: "Announcement not found or already deleted." };
        }
        await db.announcement.update({
          where: { id },
          data: {
            ...data,
            publishedAt:
              parsed.data.status === "PUBLISHED" && !existing.publishedAt
                ? new Date()
                : existing.publishedAt,
          },
        });
      } else {
        await db.announcement.create({
          data: {
            ...data,
            publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : null,
            createdById: user.id,
          },
        });
      }
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save announcement.",
    };
  }

  revalidatePath("/admin/announcements");
  revalidatePath("/admin/dashboard");
  revalidatePath("/dashboard");

  if (parsed.data.status === "DRAFT") {
    return { success: "Draft saved. Students cannot see it yet." };
  }
  return {
    success: id ? "Announcement updated and published." : "Announcement published successfully.",
  };
}

/** Publish a draft, or withdraw a published announcement back to a draft. */
export async function setAnnouncementStatusAction(
  formData: FormData,
): Promise<AnnouncementActionResult> {
  await requirePermission(PERM_ANNOUNCEMENTS_MANAGE);

  const parsed = announcementStatusSchema.safeParse({
    announcementId: formData.get("announcementId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: "Invalid announcement status change." };
  }

  const { announcementId, status } = parsed.data;

  try {
    try {
      await backendFetch(`/api/v1/announcements/${announcementId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } catch {
      const existing = await db.announcement.findUnique({
        where: { id: announcementId },
        select: { publishedAt: true },
      });
      if (!existing) return { error: "Announcement not found." };

      await db.announcement.update({
        where: { id: announcementId },
        data: {
          status: status as AnnouncementStatus,
          publishedAt:
            status === "PUBLISHED" && !existing.publishedAt ? new Date() : existing.publishedAt,
        },
      });
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to change the announcement status.",
    };
  }

  revalidatePath("/admin/announcements");
  revalidatePath("/admin/dashboard");
  revalidatePath("/dashboard");
  return {
    success:
      status === "PUBLISHED"
        ? "Announcement published. Students can see it now."
        : "Announcement withdrawn to drafts. Students can no longer see it.",
  };
}

export async function deleteAnnouncementAction(
  formData: FormData,
): Promise<AnnouncementActionResult> {
  await requirePermission(PERM_ANNOUNCEMENTS_MANAGE);

  const parsed = announcementDeleteSchema.safeParse({
    announcementId: formData.get("announcementId"),
  });

  if (!parsed.success) {
    return { error: "Invalid announcement identifier." };
  }

  try {
    try {
      await backendFetch(`/api/v1/announcements/${parsed.data.announcementId}`, {
        method: "DELETE",
      });
    } catch {
      const deleted = await db.announcement.deleteMany({
        where: { id: parsed.data.announcementId },
      });
      if (!deleted.count) {
        return { error: "Announcement not found." };
      }
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete announcement.",
    };
  }

  revalidatePath("/admin/announcements");
  revalidatePath("/admin/dashboard");
  revalidatePath("/dashboard");
  return { success: "Announcement deleted successfully." };
}
