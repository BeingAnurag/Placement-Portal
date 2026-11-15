/**
 * Branch codes for the database package's scripts. `CS` is canonical; `CSE`
 * is a legacy alias for the same branch. Mirrors `frontend/src/lib/branch.ts`
 * (this package cannot import from the frontend workspace) and the
 * `canonical_branch` SQL function from the 20261115130000 migration. See the
 * 2026-11-15 entry in docs/DECISIONS.md.
 */
const BRANCH_ALIASES: Readonly<Record<string, string>> = { CSE: "CS" };

export function canonicalBranch(value: string): string {
  const trimmed = value.trim();
  return BRANCH_ALIASES[trimmed.toUpperCase()] ?? trimmed;
}

export function canonicalBranchList(values: readonly string[]): string[] {
  return [...new Set(values.map(canonicalBranch).filter(Boolean))];
}
