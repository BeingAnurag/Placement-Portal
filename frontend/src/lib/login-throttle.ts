/**
 * Best-effort brute-force brake for password sign-in.
 *
 * The counter lives in the process, so it resets on deploy and is not shared
 * between replicas. That is enough to make online guessing impractical at the
 * current single-container deployment; move the counter to Postgres or Redis
 * before running the frontend at more than one replica.
 */

const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

type Record = { failures: number; windowStartedAt: number; lockedUntil: number };

const records = new Map<string, Record>();

function prune(now: number) {
  for (const [key, record] of records) {
    if (record.lockedUntil < now && now - record.windowStartedAt > WINDOW_MS) {
      records.delete(key);
    }
  }
}

export function isLockedOut(key: string, now = Date.now()) {
  const record = records.get(key);
  return Boolean(record && record.lockedUntil > now);
}

export function recordFailedAttempt(key: string, now = Date.now()) {
  prune(now);
  const record = records.get(key);

  if (!record || now - record.windowStartedAt > WINDOW_MS) {
    records.set(key, { failures: 1, windowStartedAt: now, lockedUntil: 0 });
    return;
  }

  record.failures += 1;
  if (record.failures >= MAX_FAILURES) {
    record.lockedUntil = now + LOCKOUT_MS;
    record.failures = 0;
    record.windowStartedAt = now;
  }
}

export function clearFailedAttempts(key: string) {
  records.delete(key);
}

/** Test seam: the counter is module state that would otherwise leak between tests. */
export function resetLoginThrottle() {
  records.clear();
}
