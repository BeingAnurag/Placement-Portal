/**
 * Branch codes. `CS` is canonical; `CSE` is a legacy alias for the same
 * branch that older roster imports and hand-typed event criteria introduced.
 * See the 2026-11-15 entry in docs/DECISIONS.md.
 *
 * The backend mirrors this in `backend/app/services/branch.py`, the database
 * package in `database/src/branch.ts`, and the database itself in the
 * `canonical_branch` SQL function. Keep the four in step.
 */

/** The B.Tech branches the institute offers, in display order. */
export const BTECH_BRANCHES = ["CSB", "IT", "CSAI", "CS"] as const;

/** Legacy spelling -> canonical code, keyed by the uppercased spelling. */
const BRANCH_ALIASES: Readonly<Record<string, string>> = { CSE: "CS" };

/**
 * One branch value in canonical form. Only a known alias is rewritten
 * (matched after trimming, case-insensitively); any other value comes back
 * trimmed but otherwise as given, so postgraduate branch names such as
 * "CS (AI&DS)" are not reshaped.
 */
export function canonicalBranch(value: string): string {
  const trimmed = value.trim();
  return BRANCH_ALIASES[trimmed.toUpperCase()] ?? trimmed;
}

/** `canonicalBranch` for an optional field; blank becomes null. */
export function canonicalBranchOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  return canonicalBranch(value) || null;
}

/**
 * A branch list in canonical form: blanks dropped, aliases rewritten, and the
 * duplicate an alias leaves behind (["CS", "CSE"] -> ["CS"]) removed, first
 * occurrence kept.
 */
export function canonicalBranchList(values: readonly string[]): string[] {
  return [...new Set(values.map(canonicalBranch).filter(Boolean))];
}

/** Comparison key: canonical code, uppercased. */
export function branchKey(value: string): string {
  return canonicalBranch(value).toUpperCase();
}
