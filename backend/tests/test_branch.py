from app.services.branch import (
    BTECH_BRANCHES,
    branch_key,
    canonical_branch,
    canonical_branch_list,
    canonical_branch_or_none,
)
from app.services.calendar import StudentContext, student_can_see
from app.services.placement_stats import counts_by_label


def test_the_btech_branch_list_is_exactly_csb_it_csai_cs():
    assert BTECH_BRANCHES == ("CSB", "IT", "CSAI", "CS")


def test_cse_in_any_case_or_spacing_becomes_cs():
    for value in ("CSE", "cse", " Cse ", "CS"):
        assert canonical_branch(value) == "CS"


def test_other_branches_are_trimmed_but_otherwise_untouched():
    assert canonical_branch(" CSAI ") == "CSAI"
    assert canonical_branch("CS (AI&DS)") == "CS (AI&DS)"
    assert canonical_branch("CSES") == "CSES"


def test_optional_branch_keeps_none_and_blank_becomes_none():
    assert canonical_branch_or_none(None) is None
    assert canonical_branch_or_none("  ") is None
    assert canonical_branch_or_none("cse") == "CS"


def test_branch_list_folds_cse_onto_cs_without_a_duplicate():
    assert canonical_branch_list(["CSE", "IT", "CS", "", None, "cse"]) == ["CS", "IT"]


def test_branch_key_treats_cs_and_cse_as_one_branch():
    assert branch_key("cse") == branch_key("CS")
    assert branch_key(None) == ""
    assert branch_key("CSAI") != branch_key("CS")


def test_branch_chart_combines_cs_and_cse_without_double_counting():
    # The analytics route feeds counts_by_label one canonical branch per
    # offer, so three CS offers and two legacy CSE offers make one bar of 5.
    branches = ["CS", "CS", "CSE", "cse", "CS", "IT", None]
    assert counts_by_label(canonical_branch_or_none(b) for b in branches) == [
        ("CS", 5),
        ("IT", 1),
        ("Not specified", 1),
    ]


def test_a_cs_targeted_calendar_entry_reaches_a_legacy_cse_student():
    def sees(student_branch, target_branches):
        return student_can_see(
            visibility="TARGETED",
            created_by_id="admin",
            target_batches=[],
            target_branches=target_branches,
            attendee_ids=None,
            student=StudentContext("stu", 2027, student_branch),
        )

    assert sees("CSE", ["CS"])
    assert sees("CS", ["CSE"])
    assert not sees("CSAI", ["CS"])
