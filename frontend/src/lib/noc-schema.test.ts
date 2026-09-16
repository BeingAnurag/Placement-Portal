import assert from "node:assert/strict";
import test from "node:test";
import { nocApproveSchema, nocCancelSchema, nocFormSchema, nocRejectSchema } from "./noc-schema";

test("nocFormSchema accepts valid submission and trims values", () => {
  const parsed = nocFormSchema.parse({
    company: "  Google India  ",
    city: "  Bengaluru  ",
    address: "  RMZ Infinity, Old Madras Road  ",
    state: "  Karnataka  ",
    pincode: "560016",
    startDate: "2026-06-01",
    endDate: "2026-08-31",
    message: "  Summer internship in core search team.  ",
  });

  assert.equal(parsed.company, "Google India");
  assert.equal(parsed.city, "Bengaluru");
  assert.equal(parsed.address, "RMZ Infinity, Old Madras Road");
  assert.equal(parsed.state, "Karnataka");
  assert.equal(parsed.pincode, "560016");
  assert.equal(parsed.message, "Summer internship in core search team.");
});

test("nocFormSchema rejects end date earlier than start date", () => {
  const res = nocFormSchema.safeParse({
    company: "Google India",
    city: "Bengaluru",
    address: "RMZ Infinity",
    state: "Karnataka",
    pincode: "560016",
    startDate: "2026-08-31",
    endDate: "2026-06-01",
  });

  assert.equal(res.success, false);
});

test("nocFormSchema rejects invalid 5-digit or alphanumeric pincode", () => {
  const invalidDigits = nocFormSchema.safeParse({
    company: "Amazon",
    city: "Hyderabad",
    address: "Financial District",
    state: "Telangana",
    pincode: "50003", // 5 digits
    startDate: "2026-06-01",
    endDate: "2026-08-31",
  });
  assert.equal(invalidDigits.success, false);

  const invalidAlpha = nocFormSchema.safeParse({
    company: "Amazon",
    city: "Hyderabad",
    address: "Financial District",
    state: "Telangana",
    pincode: "50003A", // letters
    startDate: "2026-06-01",
    endDate: "2026-08-31",
  });
  assert.equal(invalidAlpha.success, false);
});

test("nocApproveSchema and nocRejectSchema validate parameters properly", () => {
  const validApprove = nocApproveSchema.safeParse({
    nocId: "noc_123",
    adminRemarks: "Approved for summer period",
    documentUrl: "/api/v1/uploads/files/noc_docs/cert.pdf",
  });
  assert.equal(validApprove.success, true);

  const validReject = nocRejectSchema.safeParse({
    nocId: "noc_123",
    adminRemarks: "Company is not verified on our register.",
  });
  assert.equal(validReject.success, true);

  const emptyRejectReason = nocRejectSchema.safeParse({
    nocId: "noc_123",
    adminRemarks: "",
  });
  assert.equal(emptyRejectReason.success, false);

  const cancelValid = nocCancelSchema.safeParse({ nocId: "noc_123" });
  assert.equal(cancelValid.success, true);
});

test("a decision never carries the student's own message", () => {
  // `message` belongs to the student. Sending it to a decision must not stand
  // in for the remarks the placement cell is required to write.
  const approve = nocApproveSchema.parse({ nocId: "noc_123", message: "student text" });
  assert.equal(approve.adminRemarks, undefined);
  assert.equal("message" in approve, false);

  const reject = nocRejectSchema.safeParse({ nocId: "noc_123", message: "student text" });
  assert.equal(reject.success, false);
});
