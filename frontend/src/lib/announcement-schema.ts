import { z } from "zod";

const tagsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON, continue to comma split
    }
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}, z.array(z.string().trim().min(1)).transform((arr) => [...new Set(arr)]));

export const ANNOUNCEMENT_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const announcementFormSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(2, "Title must be at least 2 characters.").max(200, "Title cannot exceed 200 characters."),
    content: z.string().trim().min(2, "Content must be at least 2 characters.").max(10000, "Content cannot exceed 10,000 characters."),
    category: z.enum(["COMPANY_EVENT", "GENERAL"]),
    // Publishing is the default so an omitted status can never silently hide
    // an announcement the cell meant to send.
    status: z.enum(ANNOUNCEMENT_STATUSES).default("PUBLISHED"),
    companyId: z
      .string()
      .trim()
      .transform((value) => (value ? value : null))
      .nullable()
      .optional(),
    tags: tagsSchema,
  })
  .transform((data) => ({
    ...data,
    companyId: data.category === "GENERAL" ? null : data.companyId,
  }));

export const announcementDeleteSchema = z.object({
  announcementId: z.string().min(1, "Announcement ID is required."),
});

/** Publishing a draft, or withdrawing a published announcement to a draft. */
export const announcementStatusSchema = z.object({
  announcementId: z.string().min(1, "Announcement ID is required."),
  status: z.enum(ANNOUNCEMENT_STATUSES),
});

export type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;
