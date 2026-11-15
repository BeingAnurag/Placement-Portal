"""
Branch codes. `CS` is canonical; `CSE` is a legacy alias for the same branch
that older roster imports and hand-typed event criteria introduced. See the
2026-11-15 entry in docs/DECISIONS.md.

Mirrors `frontend/src/lib/branch.ts`, `database/src/branch.ts`, and the
`canonical_branch` SQL function. Keep the four in step.
"""
from __future__ import annotations

from typing import Iterable, Optional

# The B.Tech branches the institute offers, in display order.
BTECH_BRANCHES: tuple[str, ...] = ("CSB", "IT", "CSAI", "CS")

# Legacy spelling -> canonical code, keyed by the uppercased spelling.
_BRANCH_ALIASES: dict[str, str] = {"CSE": "CS"}


def canonical_branch(value: str) -> str:
    """
    One branch value in canonical form. Only a known alias is rewritten
    (matched after trimming, case-insensitively); any other value comes back
    trimmed but otherwise as given, so postgraduate branch names such as
    "CS (AI&DS)" are not reshaped.
    """
    trimmed = value.strip()
    return _BRANCH_ALIASES.get(trimmed.upper(), trimmed)


def canonical_branch_or_none(value: Optional[str]) -> Optional[str]:
    """`canonical_branch` for an optional field; blank becomes None."""
    if value is None:
        return None
    return canonical_branch(value) or None


def canonical_branch_list(values: Iterable[Optional[str]]) -> list[str]:
    """
    A branch list in canonical form: blanks dropped, aliases rewritten, and
    the duplicate an alias leaves behind (["CS", "CSE"] -> ["CS"]) removed,
    first occurrence kept.
    """
    result: dict[str, None] = {}
    for value in values:
        if value is None:
            continue
        branch = canonical_branch(value)
        if branch:
            result.setdefault(branch, None)
    return list(result)


def branch_key(value: Optional[str]) -> str:
    """Comparison key: canonical code, uppercased. None becomes ""."""
    return canonical_branch(value or "").upper()
