import assert from "node:assert/strict";
import test from "node:test";
import {
  announcementDeleteSchema,
  announcementFormSchema,
  announcementStatusSchema,
  MAX_ATTACHMENTS,
} from "./announcement-schema";

test("announcement schema trims values and handles comma-separated tags", () => {
  const parsed = announcementFormSchema.parse({
    id: "ann_123",
    title: "  Google Shortlist Announced  ",
    content: "  Here is the list of shortlisted candidates for round 2.  ",
    category: "COMPANY_EVENT",
    companyId: "comp_123",
    tags: "Shortlist, Round 2, Shortlist, Drive",
  });

  assert.equal(parsed.title, "Google Shortlist Announced");
  assert.equal(parsed.content, "Here is the list of shortlisted candidates for round 2.");
  assert.equal(parsed.category, "COMPANY_EVENT");
  assert.equal(parsed.companyId, "comp_123");
  assert.deepEqual(parsed.tags, ["Shortlist", "Round 2", "Drive"]);
});

test("announcement schema clears companyId when category is GENERAL", () => {
  const parsed = announcementFormSchema.parse({
    title: "Placement Policy Update",
    content: "Please review the updated placement guidelines for 2026.",
    category: "GENERAL",
    companyId: "comp_123",
    tags: ["Policy", "Guidelines"],
  });

  assert.equal(parsed.category, "GENERAL");
  assert.equal(parsed.companyId, null);
  assert.deepEqual(parsed.tags, ["Policy", "Guidelines"]);
});

test("announcement schema rejects invalid input", () => {
  const shortTitle = announcementFormSchema.safeParse({
    title: "A",
    content: "Valid content here.",
    category: "GENERAL",
  });
  assert.equal(shortTitle.success, false);

  const shortContent = announcementFormSchema.safeParse({
    title: "Valid Title",
    content: "",
    category: "GENERAL",
  });
  assert.equal(shortContent.success, false);

  const invalidCat = announcementFormSchema.safeParse({
    title: "Valid Title",
    content: "Valid content here.",
    category: "UNKNOWN_CAT",
  });
  assert.equal(invalidCat.success, false);
});

test("an announcement publishes unless it is saved as a draft", () => {
  // An omitted status must never hide an announcement the cell meant to send.
  const omitted = announcementFormSchema.parse({
    title: "Placement Policy Update",
    content: "Please review the updated placement guidelines.",
    category: "GENERAL",
  });
  assert.equal(omitted.status, "PUBLISHED");

  const draft = announcementFormSchema.parse({
    title: "Placement Policy Update",
    content: "Please review the updated placement guidelines.",
    category: "GENERAL",
    status: "DRAFT",
  });
  assert.equal(draft.status, "DRAFT");

  assert.equal(
    announcementFormSchema.safeParse({
      title: "Placement Policy Update",
      content: "Please review the updated placement guidelines.",
      category: "GENERAL",
      status: "ARCHIVED",
    }).success,
    false,
  );
});

test("the publish control accepts only the two real states", () => {
  assert.equal(
    announcementStatusSchema.safeParse({ announcementId: "ann_1", status: "PUBLISHED" }).success,
    true,
  );
  assert.equal(
    announcementStatusSchema.safeParse({ announcementId: "ann_1", status: "DRAFT" }).success,
    true,
  );
  assert.equal(
    announcementStatusSchema.safeParse({ announcementId: "ann_1", status: "LIVE" }).success,
    false,
  );
  assert.equal(
    announcementStatusSchema.safeParse({ announcementId: "", status: "DRAFT" }).success,
    false,
  );
});

test("announcement delete schema validates required ID", () => {
  const valid = announcementDeleteSchema.safeParse({ announcementId: "ann_123" });
  assert.equal(valid.success, true);

  const empty = announcementDeleteSchema.safeParse({ announcementId: "" });
  assert.equal(empty.success, false);
});

test("a company event keeps its drive and a general notice cannot have one", () => {
  const event = announcementFormSchema.parse({
    title: "Shortlist released",
    content: "The shortlist for round two is attached.",
    category: "COMPANY_EVENT",
    companyId: "cmp_1",
    jobProfileId: "job_1",
  });
  assert.equal(event.jobProfileId, "job_1");

  // Switching a company event to a general notice drops both the company and
  // the drive; a general notice is about neither.
  const general = announcementFormSchema.parse({
    title: "Placement policy update",
    content: "The revised policy takes effect on Monday.",
    category: "GENERAL",
    companyId: "cmp_1",
    jobProfileId: "job_1",
  });
  assert.equal(general.companyId, null);
  assert.equal(general.jobProfileId, null);
});

test("attachments arrive as JSON from the composer and default to none", () => {
  const withFiles = announcementFormSchema.parse({
    title: "Shortlist released",
    content: "The shortlist for round two is attached.",
    category: "COMPANY_EVENT",
    attachments: JSON.stringify([
      {
        fileName: "shortlist.pdf",
        fileUrl: "/api/v1/uploads/files/announcement_docs/abc.pdf",
        mimeType: "application/pdf",
        sizeBytes: 20480,
      },
    ]),
  });
  assert.equal(withFiles.attachments.length, 1);
  assert.equal(withFiles.attachments[0].fileName, "shortlist.pdf");

  const withoutFiles = announcementFormSchema.parse({
    title: "Placement policy update",
    content: "The revised policy takes effect on Monday.",
    category: "GENERAL",
  });
  assert.deepEqual(withoutFiles.attachments, []);
});

test("an attachment missing its size or URL is rejected", () => {
  const incomplete = announcementFormSchema.safeParse({
    title: "Shortlist released",
    content: "The shortlist for round two is attached.",
    category: "COMPANY_EVENT",
    attachments: JSON.stringify([{ fileName: "shortlist.pdf", mimeType: "application/pdf" }]),
  });
  assert.equal(incomplete.success, false);
});

test("an announcement cannot carry more files than the limit", () => {
  const tooMany = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, index) => ({
    fileName: `file-${index}.pdf`,
    fileUrl: `/api/v1/uploads/files/announcement_docs/${index}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 1024,
  }));

  const result = announcementFormSchema.safeParse({
    title: "Shortlist released",
    content: "Every shortlist is attached.",
    category: "COMPANY_EVENT",
    attachments: JSON.stringify(tooMany),
  });
  assert.equal(result.success, false);
});
