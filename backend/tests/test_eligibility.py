"""Tests for the shared eligibility engine, in particular the branch comparison."""
from __future__ import annotations

from app.services.eligibility import evaluate_eligibility, is_eligible

BASE_KWARGS = dict(
    cgpa=8.2,
    batch=2027,
    backlogs=0,
    bans=0,
    documents_complete=True,
    min_cgpa=7.5,
    job_batch=2027,
    allowed_branches=["CSE", "IT"],
    max_backlogs=0,
)


def test_eligible_student_passes_every_criterion():
    checks = evaluate_eligibility(branch="CSE", **BASE_KWARGS)
    assert is_eligible(checks)


def test_a_failed_criterion_makes_the_student_ineligible():
    kwargs = dict(BASE_KWARGS, cgpa=6.9)
    checks = evaluate_eligibility(branch="CSE", **kwargs)
    assert not is_eligible(checks)
    assert next(c for c in checks if c.key == "cgpa").passed is False


def test_branch_comparison_is_case_and_whitespace_insensitive():
    checks = evaluate_eligibility(branch=" cse ", **BASE_KWARGS)
    assert next(c for c in checks if c.key == "branch").passed is True
    assert is_eligible(checks)


def test_branch_comparison_still_rejects_a_genuinely_different_branch():
    checks = evaluate_eligibility(branch="mech", **BASE_KWARGS)
    assert next(c for c in checks if c.key == "branch").passed is False
    assert not is_eligible(checks)
