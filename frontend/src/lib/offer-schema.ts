import { z } from "zod";

export const OFFER_TYPES = ["FTE", "PPO", "INTERNSHIP"] as const;
export const OFFER_STATUSES = ["OFFERED", "ACCEPTED", "DECLINED", "REVOKED"] as const;

export type OfferType = (typeof OFFER_TYPES)[number];
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  FTE: "Full-time placement",
  PPO: "Pre-placement offer",
  INTERNSHIP: "Internship",
};

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  OFFERED: "Offered",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  REVOKED: "Revoked",
};

/** FTE and PPO offers carry an annual CTC; internships carry a monthly stipend. */
export function isCtcType(type: string): boolean {
  return type === "FTE" || type === "PPO";
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value ? value : null))
  .nullable()
  .optional();

const optionalAmount = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().nonnegative("Amount cannot be negative.").optional(),
);

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);

export const offerFormSchema = z
  .object({
    id: z.string().trim().optional(),
    userId: z.string().trim().min(1, "Select a student."),
    companyId: z.string().trim().min(1, "Select a company."),
    jobProfileId: optionalText,
    type: z.enum(OFFER_TYPES),
    status: z.enum(OFFER_STATUSES).default("OFFERED"),
    batch: z.coerce
      .number()
      .int()
      .min(2000, "Enter a four-digit season year.")
      .max(2100, "Enter a four-digit season year."),
    ctc: optionalAmount,
    stipend: optionalAmount,
    location: optionalText,
    offeredAt: optionalDate,
    joiningDate: optionalDate,
    remarks: optionalText,
  })
  // The amount is required, but which one depends on the offer type, so the
  // rule lives here rather than on either field. The backend repeats it: this
  // check only exists to answer the administrator before the round trip.
  .superRefine((data, ctx) => {
    if (isCtcType(data.type) && data.ctc === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ctc"],
        message: "Enter the annual CTC for a placement or pre-placement offer.",
      });
    }
    if (data.type === "INTERNSHIP" && data.stipend === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stipend"],
        message: "Enter the monthly stipend for an internship offer.",
      });
    }
  })
  // An offer only ever holds the figure that matches its type, so switching a
  // recorded internship to an FTE cannot leave a stale stipend behind.
  .transform((data) => ({
    ...data,
    ctc: isCtcType(data.type) ? data.ctc ?? null : null,
    stipend: data.type === "INTERNSHIP" ? data.stipend ?? null : null,
  }));

export const offerDeleteSchema = z.object({
  offerId: z.string().trim().min(1, "Offer ID is required."),
});

export type OfferFormValues = z.infer<typeof offerFormSchema>;

/**
 * Indian-format currency for the dashboard and the records table. Amounts are
 * whole rupees; lakhs and crores are how the office reads them.
 */
export function formatRupees(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)} LPA`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** Stipends are monthly, so they never read as LPA. */
export function formatStipend(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return `₹${Math.round(amount).toLocaleString("en-IN")}/month`;
}
