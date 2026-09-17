import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null);
const optionalEmail = z
  .union([z.literal(""), z.string().trim().email()])
  .transform((value) => value || null);
const optionalNumber = (minimum: number, maximum: number, integer = false) =>
  z.preprocess(
    (value) => value === "" ? null : Number(value),
    (integer ? z.number().int() : z.number()).min(minimum).max(maximum).nullable(),
  );
const optionalDate = z.preprocess(
  (value) => value === "" ? null : new Date(String(value)),
  z.date().max(new Date()).nullable(),
);

// Full name, roll number, branch, degree, and graduation year (batch) are set
// by the placement office from the official roster and are deliberately not
// part of this schema: a student cannot write them through this action, no
// matter what a crafted request includes, because the field is never parsed.
export const studentProfileSchema = z.object({
  personalEmail: optionalEmail,
  contactNumber: optionalText(20),
  altContactNumber: optionalText(20),
  gender: optionalText(30),
  bloodGroup: optionalText(10),
  dateOfBirth: optionalDate,
  currentAddress: optionalText(500),
  class10Percent: optionalNumber(0, 100),
  class12Percent: optionalNumber(0, 100),
  cgpa: optionalNumber(0, 10),
  backlogs: optionalNumber(0, 100, true).transform((value) => value ?? 0),
});

export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
