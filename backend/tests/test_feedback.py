"""Tests for Feedback schemas, content parsing, permissions, and response formatting."""
from __future__ import annotations

from datetime import datetime
import json
import pytest
from pydantic import ValidationError

from app.core.security import (
    PERM_FEEDBACK_RESOLVE,
    PERM_FEEDBACK_RESPOND,
    compute_effective_permissions,
    has_permission,
)
from app.models.db import Feedback, FeedbackType, User
from app.routers.feedback import _read_content, _to_admin_feedback_response, _to_feedback_response
from app.schemas.feedback import (
    AdminFeedbackResponse,
    FeedbackCreate,
    FeedbackMetricsResponse,
    FeedbackReplyRequest,
    FeedbackResponse,
)


def test_feedback_create_schema_valid():
    content_obj = json.dumps({"subject": "Portal login issue", "message": "Getting 401 when accessing forms."})
    fb = FeedbackCreate(feedbackType="QUERY", content=content_obj)
    assert fb.feedbackType == "QUERY"

    fb_lower = FeedbackCreate(feedbackType="complaint", content=content_obj)
    assert fb_lower.feedbackType == "COMPLAINT"


def test_feedback_create_schema_rejects_invalid_type():
    with pytest.raises(ValidationError):
        FeedbackCreate(feedbackType="INVALID_TYPE", content="Some valid content here.")


def test_feedback_create_schema_rejects_short_content():
    with pytest.raises(ValidationError):
        FeedbackCreate(feedbackType="FEEDBACK", content="hi")


def test_read_content_json_and_plain_text():
    raw_json = json.dumps({"subject": "Need help with resume", "message": "How do I upload custom resume label?"})
    sub, msg = _read_content(raw_json)
    assert sub == "Need help with resume"
    assert msg == "How do I upload custom resume label?"

    plain = "Direct feedback about placement drive schedule."
    sub2, msg2 = _read_content(plain)
    assert sub2 == plain[:60]
    assert msg2 == plain


def test_feedback_reply_schema_valid():
    reply = FeedbackReplyRequest(adminResponse="We have resolved the server issue. Please try again.", resolve=True)
    assert reply.adminResponse.startswith("We have resolved")
    assert reply.resolve is True


def test_feedback_reply_schema_rejects_empty():
    with pytest.raises(ValidationError):
        FeedbackReplyRequest(adminResponse="", resolve=True)


def test_feedback_manage_permission_hierarchy():
    super_admin_perms = compute_effective_permissions("SUPER_ADMIN")
    assert PERM_FEEDBACK_RESPOND in super_admin_perms

    team_perms = compute_effective_permissions("PLACEMENT_TEAM")
    assert PERM_FEEDBACK_RESPOND in team_perms

    # Volunteers answer student queries, but cannot close them out.
    volunteer_perms = compute_effective_permissions("PLACEMENT_VOLUNTEER")
    assert PERM_FEEDBACK_RESPOND in volunteer_perms
    assert PERM_FEEDBACK_RESOLVE not in volunteer_perms

    student_perms = compute_effective_permissions("STUDENT")
    assert PERM_FEEDBACK_RESPOND not in student_perms

    custom_student = compute_effective_permissions("STUDENT", custom_permissions=[PERM_FEEDBACK_RESPOND])
    assert PERM_FEEDBACK_RESPOND in custom_student


def test_to_admin_feedback_response_formatting():
    now = datetime.now()
    user = User(
        id="usr_999",
        name="Meera Krishnan",
        email="meera@iiitl.ac.in",
        rollNumber="LCB2023012",
        branch="CSB",
        batch=2027,
        contactNumber="+91 9123456780",
    )
    raw_json = json.dumps({"subject": "NOC timeline inquiry", "message": "When will winter NOCs be processed?"})
    fb = Feedback(
        id="fb_001",
        userId="usr_999",
        feedbackType=FeedbackType.QUERY,
        content=raw_json,
        resolved=True,
        adminResponse="NOCs are processed within 2 business days.",
        createdAt=now,
        resolvedAt=now,
    )
    fb.user = user

    resp = _to_admin_feedback_response(fb)
    assert resp.id == "fb_001"
    assert resp.feedbackType == "QUERY"
    assert resp.subject == "NOC timeline inquiry"
    assert resp.message == "When will winter NOCs be processed?"
    assert resp.resolved is True
    assert resp.adminResponse == "NOCs are processed within 2 business days."
    assert resp.student is not None
    assert resp.student.name == "Meera Krishnan"
    assert resp.student.rollNumber == "LCB2023012"
