"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { offerDeleteSchema, offerFormSchema } from "@/lib/offer-schema";
import {
  PERM_PLACEMENT_RECORDS_CREATE,
  PERM_PLACEMENT_RECORDS_DELETE,
  PERM_PLACEMENT_RECORDS_UPDATE,
} from "@/lib/permissions";

export type OfferActionResult = { error?: string; success?: string };

// Offers exist only in the backend. Unlike the older admin screens there is no
// Prisma fallback here: the dashboard aggregates these rows, and a second
// write path is how the application export drifted from its endpoint.
function revalidateOfferPages() {
  revalidatePath("/admin/placement-records");
  revalidatePath("/admin/dashboard");
}

function backendMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(error.message) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    // The backend returned plain text rather than a JSON error body.
  }
  return error.message || fallback;
}

export async function saveOfferAction(formData: FormData): Promise<OfferActionResult> {
  await requirePermission(
    formData.get("id") ? PERM_PLACEMENT_RECORDS_UPDATE : PERM_PLACEMENT_RECORDS_CREATE,
  );

  const parsed = offerFormSchema.safeParse({
    id: formData.get("id") ?? undefined,
    userId: formData.get("userId"),
    companyId: formData.get("companyId"),
    jobProfileId: formData.get("jobProfileId") ?? "",
    type: formData.get("type"),
    status: formData.get("status") || "OFFERED",
    batch: formData.get("batch"),
    ctc: formData.get("ctc") ?? "",
    stipend: formData.get("stipend") ?? "",
    location: formData.get("location") ?? "",
    offeredAt: formData.get("offeredAt") ?? "",
    joiningDate: formData.get("joiningDate") ?? "",
    remarks: formData.get("remarks") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the offer details." };
  }

  const { id, ...offer } = parsed.data;
  const payload = {
    userId: offer.userId,
    companyId: offer.companyId,
    jobProfileId: offer.jobProfileId,
    type: offer.type,
    status: offer.status,
    batch: offer.batch,
    ctc: offer.ctc,
    stipend: offer.stipend,
    location: offer.location,
    offeredAt: offer.offeredAt?.toISOString() ?? null,
    joiningDate: offer.joiningDate?.toISOString() ?? null,
    remarks: offer.remarks,
  };

  try {
    if (id) {
      await backendFetch(`/api/v1/offers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await backendFetch("/api/v1/offers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
  } catch (error) {
    return { error: backendMessage(error, "Failed to save the placement record.") };
  }

  revalidateOfferPages();
  return { success: id ? "Placement record updated." : "Placement record added." };
}

export async function deleteOfferAction(formData: FormData): Promise<OfferActionResult> {
  await requirePermission(PERM_PLACEMENT_RECORDS_DELETE);

  const parsed = offerDeleteSchema.safeParse({ offerId: formData.get("offerId") });
  if (!parsed.success) return { error: "Invalid placement record." };

  try {
    await backendFetch(`/api/v1/offers/${parsed.data.offerId}`, { method: "DELETE" });
  } catch (error) {
    return { error: backendMessage(error, "Failed to delete the placement record.") };
  }

  revalidateOfferPages();
  return { success: "Placement record deleted." };
}
