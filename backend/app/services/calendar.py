"""
Pure rules for the placement calendar.

Nothing here touches the database: the router loads rows and hands plain data
to these functions, so who-sees-what and the clash warnings can be unit-tested
directly (the same split as `services/student_flags.py`).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

# A range wider than this is refused: the widest view (a month grid with its
# leading and trailing days) is six weeks, and an unbounded range is an
# unbounded query.
MAX_RANGE = timedelta(days=100)

# A single entry longer than this is almost certainly a typo in the end date.
MAX_EVENT_DURATION = timedelta(days=14)


def to_utc(value: datetime) -> datetime:
    """
    An aware UTC datetime.

    Prisma stores `TIMESTAMP(3)` without a zone, holding UTC by convention, so
    a value read back can be naive; one arriving from a client can carry any
    offset (the portal's users are in IST). Both become aware UTC here, so a
    response always serialises with an explicit offset and the browser never
    has to guess.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def ranges_overlap(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """Half-open overlap: an event ending at 11:00 does not clash with one starting at 11:00."""
    return to_utc(a_start) < to_utc(b_end) and to_utc(b_start) < to_utc(a_end)


@dataclass(frozen=True)
class StudentContext:
    id: str
    batch: int | None
    branch: str | None


def _norm_branch(value: str | None) -> str:
    return (value or "").strip().lower()


def student_can_see(
    *,
    visibility: str,
    created_by_id: str,
    target_batches: list[int] | None,
    target_branches: list[str] | None,
    attendee_ids: set[str] | None,
    student: StudentContext,
) -> bool:
    """
    Whether a student may see one calendar entry.

    STAFF is never visible. STUDENTS always is. TARGETED needs the student's
    batch to be in `target_batches` and their branch in `target_branches`, an
    empty list on either side meaning "any" — so a TARGETED event with both
    empty reaches every student, which the write path refuses to create. A
    student with no batch on record is outside every batch-targeted event
    rather than inside all of them. ATTENDEES needs the student listed;
    PRIVATE needs the student to be its author.
    """
    if visibility == "STUDENTS":
        return True
    if visibility == "PRIVATE":
        return created_by_id == student.id
    if visibility == "ATTENDEES":
        return bool(attendee_ids) and student.id in attendee_ids
    if visibility == "TARGETED":
        batches = target_batches or []
        branches = [_norm_branch(b) for b in (target_branches or []) if _norm_branch(b)]
        if batches and student.batch not in batches:
            return False
        if branches and _norm_branch(student.branch) not in branches:
            return False
        return True
    return False


@dataclass
class EventSlot:
    """The parts of an event the clash check needs."""

    id: str | None
    title: str
    starts_at: datetime
    ends_at: datetime
    company_id: str | None = None
    company_name: str | None = None
    # user id -> display name
    pocs: dict[str, str] = field(default_factory=dict)


def find_conflicts(candidate: EventSlot, others: list[EventSlot]) -> list[str]:
    """
    Human-readable warnings for a staff event about to be saved.

    Two clashes matter to the placement cell: the same company booked at an
    overlapping time under a different POC (two people talking to one
    recruiter without knowing it), and one POC booked into two places at once.
    These are warnings, not errors — a panel interview can legitimately run
    alongside a talk — so the save goes ahead and the caller shows them.
    """
    warnings: list[str] = []
    for other in others:
        if candidate.id is not None and other.id == candidate.id:
            continue
        if not ranges_overlap(candidate.starts_at, candidate.ends_at, other.starts_at, other.ends_at):
            continue

        if candidate.company_id and other.company_id == candidate.company_id:
            if set(other.pocs) != set(candidate.pocs):
                company = candidate.company_name or other.company_name or "This company"
                owners = ", ".join(sorted(other.pocs.values())) or "no POC assigned"
                warnings.append(
                    f'{company} already has "{other.title}" at an overlapping time ({owners}).'
                )

        for poc_id in sorted(set(candidate.pocs) & set(other.pocs)):
            name = candidate.pocs.get(poc_id) or other.pocs.get(poc_id) or "A POC"
            warnings.append(f'{name} is already POC for "{other.title}" at an overlapping time.')

    # Order-preserving de-duplication: two shared POCs on one event must not
    # print the company line twice.
    return list(dict.fromkeys(warnings))
