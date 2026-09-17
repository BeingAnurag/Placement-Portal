"""
Shared FastAPI dependency functions.
Import these in routers rather than importing from core modules directly.
"""
from __future__ import annotations

from app.core.database import get_db
from app.core.security import (
    get_current_user,
    require_admin,
    require_any_permission,
    require_permission,
    require_student,
)

__all__ = [
    "get_db",
    "require_student",
    "require_admin",
    "get_current_user",
    "require_permission",
    "require_any_permission",
]

