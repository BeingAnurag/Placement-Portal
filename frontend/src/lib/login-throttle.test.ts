import assert from "node:assert/strict";
import test from "node:test";
import {
  clearFailedAttempts,
  isLockedOut,
  recordFailedAttempt,
  resetLoginThrottle,
} from "./login-throttle";

const MINUTE = 60 * 1000;
const key = "student@iiitl.ac.in";

test("an address locks only after a run of failures, and the lock expires", () => {
  resetLoginThrottle();
  for (let attempt = 0; attempt < 7; attempt += 1) recordFailedAttempt(key, MINUTE);
  assert.equal(isLockedOut(key, MINUTE), false);

  recordFailedAttempt(key, MINUTE);
  assert.equal(isLockedOut(key, MINUTE), true);
  assert.equal(isLockedOut(key, MINUTE + 14 * MINUTE), true);
  assert.equal(isLockedOut(key, MINUTE + 16 * MINUTE), false);
});

test("failures spread beyond the window never accumulate into a lock", () => {
  resetLoginThrottle();
  for (let attempt = 0; attempt < 7; attempt += 1) recordFailedAttempt(key, 0);
  recordFailedAttempt(key, 16 * MINUTE);
  assert.equal(isLockedOut(key, 16 * MINUTE), false);
});

test("a successful sign-in clears the count", () => {
  resetLoginThrottle();
  for (let attempt = 0; attempt < 7; attempt += 1) recordFailedAttempt(key, MINUTE);
  clearFailedAttempts(key);

  recordFailedAttempt(key, MINUTE);
  assert.equal(isLockedOut(key, MINUTE), false);
});

test("addresses are throttled independently", () => {
  resetLoginThrottle();
  for (let attempt = 0; attempt < 8; attempt += 1) recordFailedAttempt(key, MINUTE);
  assert.equal(isLockedOut(key, MINUTE), true);
  assert.equal(isLockedOut("other@iiitl.ac.in", MINUTE), false);
});
