import { z } from "zod";

const optionalParagraph = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `This section must not exceed ${max} characters.`)
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null));

export const interviewExperienceFormSchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(2, "Company name must be at least 2 characters.")
      .max(200, "Company name must not exceed 200 characters."),
    role: z
      .string()
      .trim()
      .min(2, "Role must be at least 2 characters.")
      .max(150, "Role must not exceed 150 characters."),
    batch: z.coerce
      .number()
      .int("Batch must be a year, e.g. 2026.")
      .min(2000, "Enter a valid graduating batch year.")
      .max(2100, "Enter a valid graduating batch year."),
    interviewType: z
      .string()
      .trim()
      .min(2, "Interview type is required.")
      .max(100, "Interview type must not exceed 100 characters."),
    dsaQuestions: optionalParagraph(8000),
    oopsQuestions: optionalParagraph(8000),
    dbmsQuestions: optionalParagraph(8000),
    osQuestions: optionalParagraph(8000),
    cnQuestions: optionalParagraph(8000),
    sqlQuestions: optionalParagraph(8000),
    systemDesignQuestions: optionalParagraph(8000),
    csFundamentalsQuestions: optionalParagraph(8000),
    resumeQuestions: optionalParagraph(8000),
    projectsDiscussed: optionalParagraph(8000),
    codingQuestions: optionalParagraph(8000),
    aptitudeQuestions: optionalParagraph(8000),
    hrQuestions: optionalParagraph(8000),
    behavioralQuestions: optionalParagraph(8000),
    resources: optionalParagraph(4000),
    unansweredQuestions: optionalParagraph(4000),
    tips: optionalParagraph(4000),
  })
  .refine(
    (data) => {
      const questionFields = [
        data.dsaQuestions,
        data.oopsQuestions,
        data.dbmsQuestions,
        data.osQuestions,
        data.cnQuestions,
        data.sqlQuestions,
        data.systemDesignQuestions,
        data.csFundamentalsQuestions,
        data.resumeQuestions,
        data.projectsDiscussed,
        data.codingQuestions,
        data.aptitudeQuestions,
        data.hrQuestions,
        data.behavioralQuestions,
        data.resources,
        data.unansweredQuestions,
        data.tips,
      ];
      return questionFields.some((field) => field && field.length > 0);
    },
    {
      message: "Share at least one question, resource, or tip so the submission is useful to other students.",
      path: ["dsaQuestions"],
    }
  );

export type InterviewExperienceFormData = z.infer<typeof interviewExperienceFormSchema>;

export const INTERVIEW_TYPE_OPTIONS = [
  "On-Campus",
  "Pool Campus",
  "Off-Campus",
  "Internship",
  "Full-Time",
] as const;
