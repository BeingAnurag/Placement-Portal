import assert from "node:assert/strict";
import test from "node:test";
import {
  BTECH_BRANCHES,
  branchKey,
  canonicalBranch,
  canonicalBranchList,
  canonicalBranchOrNull,
} from "./branch";

test("the B.Tech branch list is exactly CSB, IT, CSAI, CS", () => {
  assert.deepEqual([...BTECH_BRANCHES], ["CSB", "IT", "CSAI", "CS"]);
});

test("CSE in any case or spacing becomes CS", () => {
  for (const value of ["CSE", "cse", " Cse ", "CS"]) assert.equal(canonicalBranch(value), "CS");
});

test("other branches are trimmed but otherwise untouched", () => {
  assert.equal(canonicalBranch(" CSAI "), "CSAI");
  assert.equal(canonicalBranch("CS (AI&DS)"), "CS (AI&DS)");
  assert.equal(canonicalBranch("CSES"), "CSES");
});

test("an optional branch keeps null and turns blank into null", () => {
  assert.equal(canonicalBranchOrNull(null), null);
  assert.equal(canonicalBranchOrNull(undefined), null);
  assert.equal(canonicalBranchOrNull("  "), null);
  assert.equal(canonicalBranchOrNull("cse"), "CS");
});

test("a branch list folds CSE onto CS without leaving a duplicate", () => {
  assert.deepEqual(canonicalBranchList(["CSE", "IT", "CS", "", "cse"]), ["CS", "IT"]);
});

test("the comparison key treats CS and CSE as one branch", () => {
  assert.equal(branchKey("cse"), branchKey("CS"));
  assert.notEqual(branchKey("CSAI"), branchKey("CS"));
});
