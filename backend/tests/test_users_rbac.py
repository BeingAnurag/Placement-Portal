"""Tests for RBAC permission computation, role assignment, and security guardrails."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core import security
from app.core.config import Settings
from app.core.security import (
    ALL_PERMISSIONS,
    PERM_APPLICATIONS_UPDATE,
    PERM_COMPANIES_CREATE,
    PERM_JOBS_CREATE,
    PERM_RBAC_MANAGE,
    PERM_STUDENTS_VIEW,
    PERM_USERS_MANAGE,
    PERM_USERS_VIEW,
    ROLE_DEFAULT_PERMISSIONS,
    compute_effective_permissions,
    has_any_admin_permission,
    has_permission,
    is_elevated_role,
)
from app.models.db import Role


def build_settings(**overrides) -> Settings:
    base = {
        "admin_emails": "super@iiitl.ac.in",
        "student_email_domain": "iiitl.ac.in",
        "auth_secret": "test-secret",
        "cors_origins": "http://localhost:3000",
    }
    base.update(overrides)
    return Settings(**base)


@pytest.fixture
def configured(monkeypatch):
    def _apply(**overrides) -> Settings:
        replacement = build_settings(**overrides)
        monkeypatch.setattr(security, "settings", replacement)
        return replacement

    return _apply


def test_super_admin_has_all_permissions(configured):
    configured()
    perms = compute_effective_permissions("SUPER_ADMIN")
    assert set(perms) == set(ALL_PERMISSIONS)


def test_admin_email_receives_all_permissions_automatically(configured):
    configured(admin_emails="lead@iiitl.ac.in")
    perms = compute_effective_permissions("STUDENT", email="lead@iiitl.ac.in")
    assert set(perms) == set(ALL_PERMISSIONS)


def test_placement_role_default_permissions(configured):
    configured()
    volunteer_perms = compute_effective_permissions("PLACEMENT_VOLUNTEER")
    assert PERM_STUDENTS_VIEW in volunteer_perms
    assert PERM_JOBS_CREATE not in volunteer_perms
    assert PERM_APPLICATIONS_UPDATE not in volunteer_perms
    assert PERM_USERS_MANAGE not in volunteer_perms

    team_perms = compute_effective_permissions("PLACEMENT_TEAM")
    assert PERM_COMPANIES_CREATE in team_perms
    assert PERM_JOBS_CREATE in team_perms
    assert PERM_APPLICATIONS_UPDATE in team_perms
    assert PERM_USERS_VIEW in team_perms
    # The placement cell runs drives; it never administers the portal itself.
    assert PERM_USERS_MANAGE not in team_perms
    assert PERM_RBAC_MANAGE not in team_perms


def test_only_super_admin_manages_rbac(configured):
    configured()
    for role in ("STUDENT", "PLACEMENT_VOLUNTEER", "PLACEMENT_TEAM"):
        assert PERM_RBAC_MANAGE not in compute_effective_permissions(role)
    assert PERM_RBAC_MANAGE in compute_effective_permissions("SUPER_ADMIN")


def test_own_scoped_permissions_do_not_grant_admin_access(configured):
    """
    Regression: the admin gate used to test whether the permission list was
    non-empty. Students hold own-scoped permissions by default, so a count is
    never evidence of administrative access.
    """
    configured()
    student = {"role": "STUDENT", "email": "s@iiitl.ac.in"}
    assert compute_effective_permissions("STUDENT") != []
    assert has_any_admin_permission(student) is False

    revoking_student = {
        "role": "STUDENT",
        "email": "s@iiitl.ac.in",
        "customPermissions": ["-applications.apply"],
    }
    assert has_any_admin_permission(revoking_student) is False

    granted_student = {
        "role": "STUDENT",
        "email": "s@iiitl.ac.in",
        "customPermissions": [PERM_STUDENTS_VIEW],
    }
    assert has_any_admin_permission(granted_student) is True


def test_custom_permissions_grant_and_revoke(configured):
    configured()
    # Grant custom permission to student
    student_custom = compute_effective_permissions("STUDENT", custom_permissions=[PERM_JOBS_CREATE])
    assert PERM_JOBS_CREATE in student_custom

    # Explicit revocation from the placement team
    team_revoked = compute_effective_permissions(
        "PLACEMENT_TEAM",
        custom_permissions=[f"-{PERM_JOBS_CREATE}"],
    )
    assert PERM_JOBS_CREATE not in team_revoked
    assert PERM_APPLICATIONS_UPDATE in team_revoked


def test_has_permission_checks_payload(configured):
    configured(admin_emails="admin@iiitl.ac.in")

    # Super admin
    assert has_permission({"role": "SUPER_ADMIN", "email": "user@iiitl.ac.in"}, PERM_USERS_MANAGE) is True

    # Admin email override
    assert has_permission({"role": "STUDENT", "email": "admin@iiitl.ac.in"}, PERM_USERS_MANAGE) is True

    # Placement team without user management
    assert has_permission({"role": "PLACEMENT_TEAM", "email": "team@iiitl.ac.in"}, PERM_USERS_MANAGE) is False
    assert has_permission({"role": "PLACEMENT_TEAM", "email": "team@iiitl.ac.in"}, PERM_JOBS_CREATE) is True

    # Student with custom permission
    assert has_permission(
        {"role": "STUDENT", "email": "s@iiitl.ac.in", "customPermissions": [PERM_COMPANIES_CREATE]},
        PERM_COMPANIES_CREATE,
    ) is True


def test_is_elevated_role():
    assert is_elevated_role("SUPER_ADMIN") is True
    assert is_elevated_role("PLACEMENT_TEAM") is True
    assert is_elevated_role("PLACEMENT_VOLUNTEER") is True
    assert is_elevated_role("STUDENT") is False


def test_require_permission_dependency(configured):
    configured()
    dep = security.require_permission(PERM_USERS_MANAGE)

    # Allowed
    allowed_payload = {"sub": "1", "email": "super@iiitl.ac.in", "role": "SUPER_ADMIN"}
    assert dep(allowed_payload) == allowed_payload

    # Denied
    denied_payload = {"sub": "2", "email": "student@iiitl.ac.in", "role": "STUDENT"}
    with pytest.raises(HTTPException) as exc:
        dep(denied_payload)
    assert exc.value.status_code == 403


def test_deactivated_account_is_rejected(configured):
    configured()
    from jose import jwt
    secret = "test-secret"
    token = jwt.encode({"sub": "1", "email": "student@iiitl.ac.in", "role": "STUDENT", "isActive": False}, secret, algorithm="HS256")
    from fastapi.security import HTTPAuthorizationCredentials
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with pytest.raises(HTTPException) as exc:
        security.get_current_user(creds)
    assert exc.value.status_code == 403
    assert "deactivated" in exc.value.detail.lower()



def test_placement_team_cannot_reach_rbac_endpoints(configured):
    """
    The role-assignment and permission-matrix endpoints are gated on
    rbac.manage, which only SUPER_ADMIN holds. A Placement Team member holding
    users.manage must not be able to promote anyone, including themselves.
    """
    configured()
    dep = security.require_permission(PERM_RBAC_MANAGE)

    team_payload = {"sub": "2", "email": "team@iiitl.ac.in", "role": "PLACEMENT_TEAM"}
    with pytest.raises(HTTPException) as exc:
        dep(team_payload)
    assert exc.value.status_code == 403

    volunteer_payload = {"sub": "3", "email": "vol@iiitl.ac.in", "role": "PLACEMENT_VOLUNTEER"}
    with pytest.raises(HTTPException) as exc:
        dep(volunteer_payload)
    assert exc.value.status_code == 403

    super_payload = {"sub": "1", "email": "boss@iiitl.ac.in", "role": "SUPER_ADMIN"}
    assert dep(super_payload) == super_payload


def test_stale_permission_keys_are_not_administrative(configured):
    """
    A JWT issued before the catalog migration carries the old colon-style keys.
    They are not in the catalog, so they must not satisfy the admin gate.
    """
    configured()
    stale = {
        "sub": "9",
        "email": "student@iiitl.ac.in",
        "role": "STUDENT",
        "permissions": ["users:read", "companies:manage", "jobs:manage"],
    }
    assert security.has_any_admin_permission(stale) is False
