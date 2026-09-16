import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRupees,
  formatStipend,
  isCtcType,
  offerFormSchema,
} from "./offer-schema";

const base = {
  userId: "usr_1",
  companyId: "cmp_1",
  batch: "2027",
  status: "OFFERED",
};

test("a placement offer requires an annual CTC", () => {
  const missing = offerFormSchema.safeParse({ ...base, type: "FTE" });
  assert.equal(missing.success, false);
  assert.equal(missing.error?.issues[0]?.path[0], "ctc");

  const valid = offerFormSchema.safeParse({ ...base, type: "FTE", ctc: "1800000" });
  assert.equal(valid.success, true);
  assert.equal(valid.data?.ctc, 1_800_000);
});

test("an internship requires a monthly stipend", () => {
  const missing = offerFormSchema.safeParse({ ...base, type: "INTERNSHIP" });
  assert.equal(missing.success, false);
  assert.equal(missing.error?.issues[0]?.path[0], "stipend");

  const valid = offerFormSchema.safeParse({ ...base, type: "INTERNSHIP", stipend: "75000" });
  assert.equal(valid.success, true);
  assert.equal(valid.data?.stipend, 75_000);
});

test("an offer keeps only the amount its type uses", () => {
  // Re-recording an internship as a full-time offer must not leave the old
  // monthly stipend sitting on the row, where the dashboard would average it.
  const parsed = offerFormSchema.parse({
    ...base,
    type: "FTE",
    ctc: "2400000",
    stipend: "50000",
  });
  assert.equal(parsed.ctc, 2_400_000);
  assert.equal(parsed.stipend, null);

  const internship = offerFormSchema.parse({
    ...base,
    type: "INTERNSHIP",
    ctc: "2400000",
    stipend: "50000",
  });
  assert.equal(internship.ctc, null);
  assert.equal(internship.stipend, 50_000);
});

test("a pre-placement offer is priced like a placement", () => {
  assert.equal(isCtcType("PPO"), true);
  assert.equal(isCtcType("INTERNSHIP"), false);

  const ppo = offerFormSchema.safeParse({ ...base, type: "PPO", ctc: "2000000" });
  assert.equal(ppo.success, true);
});

test("the season must be a four-digit year and the student and company are required", () => {
  assert.equal(
    offerFormSchema.safeParse({ ...base, batch: "27", type: "FTE", ctc: "10" }).success,
    false,
  );
  assert.equal(
    offerFormSchema.safeParse({ ...base, userId: "", type: "FTE", ctc: "10" }).success,
    false,
  );
  assert.equal(
    offerFormSchema.safeParse({ ...base, companyId: "", type: "FTE", ctc: "10" }).success,
    false,
  );
});

test("packages read in the units the office uses", () => {
  assert.equal(formatRupees(1_800_000), "₹18.00 LPA");
  assert.equal(formatRupees(12_500_000), "₹1.25 Cr");
  assert.equal(formatRupees(45_000), "₹45,000");
  assert.equal(formatRupees(null), "—");
  assert.equal(formatStipend(75_000), "₹75,000/month");
  assert.equal(formatStipend(null), "—");
});
