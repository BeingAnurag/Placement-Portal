"""
File storage helpers (Cloudinary + Local Filesystem Fallback).
"""
from __future__ import annotations

import io
import os
from pathlib import Path

import cloudinary
import cloudinary.uploader

from app.core.config import settings

_PDF_MAGIC = b"%PDF"
_MAX_BYTES = settings.allowed_pdf_size_mb * 1024 * 1024

_DEFAULT_UPLOADS = "/tmp/uploads" if os.path.exists("/app") else "./uploads"
LOCAL_UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR", _DEFAULT_UPLOADS))
try:
    LOCAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    LOCAL_UPLOADS_DIR = Path("/tmp/uploads")
    LOCAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _is_cloudinary_configured() -> bool:
    name = (settings.cloudinary_cloud_name or "").strip()
    key = (settings.cloudinary_api_key or "").strip()
    secret = (settings.cloudinary_api_secret or "").strip()
    if not name or not key or not secret:
        return False
    if name in ("placeholder", "dummy", "your-cloud-name") or key in ("placeholder", "dummy", "your-api-key"):
        return False
    return True


if _is_cloudinary_configured():
    try:
        cloudinary.config(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
            secure=True,
        )
    except Exception:
        pass


class StorageError(Exception):
    """Raised when a file fails validation or upload."""


def validate_pdf(data: bytes) -> None:
    """
    Validates that a file is a real PDF within the size limit.
    Raises StorageError on failure.
    """
    max_bytes = settings.allowed_pdf_size_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise StorageError(
            f"File exceeds the {settings.allowed_pdf_size_mb} MB limit. "
            f"Received {len(data) / (1024 * 1024):.1f} MB."
        )
    if not data.startswith(_PDF_MAGIC):
        raise StorageError(
            "Only PDF files are accepted. The file does not have a valid PDF signature."
        )


# What an announcement may carry. A shortlist arrives as a spreadsheet and a
# venue map as an image, so this list is wider than the resume rule, but it is
# still a closed list checked against the bytes rather than the file name.
ATTACHMENT_TYPES: dict[str, str] = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "csv": "text/csv",
    "txt": "text/plain",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

_ZIP_MAGIC = b"PK\x03\x04"
_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_JPEG_MAGIC = b"\xff\xd8\xff"


def validate_attachment(data: bytes, filename: str, max_mb: int) -> tuple[str, str]:
    """
    Validate an announcement attachment against the closed type list.

    Returns the lowercase extension and the media type to store. Raises
    StorageError with a message meant for the uploader.
    """
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    media_type = ATTACHMENT_TYPES.get(extension)
    if not media_type:
        allowed = ", ".join(f".{name}" for name in sorted(ATTACHMENT_TYPES))
        raise StorageError(f"'{filename}' is not an accepted file type. Allowed: {allowed}.")

    if not data:
        raise StorageError(f"'{filename}' is empty.")
    if len(data) > max_mb * 1024 * 1024:
        raise StorageError(
            f"'{filename}' exceeds the {max_mb} MB limit. "
            f"Received {len(data) / (1024 * 1024):.1f} MB."
        )

    # A renamed executable is the thing this catches: the signature has to
    # agree with the extension. Text formats have no signature, so they are
    # held to decoding as text instead.
    if extension == "pdf" and not data.startswith(_PDF_MAGIC):
        raise StorageError(f"'{filename}' is not a valid PDF.")
    if extension == "png" and not data.startswith(_PNG_MAGIC):
        raise StorageError(f"'{filename}' is not a valid PNG image.")
    if extension in ("jpg", "jpeg") and not data.startswith(_JPEG_MAGIC):
        raise StorageError(f"'{filename}' is not a valid JPEG image.")
    if extension in ("docx", "xlsx") and not data.startswith(_ZIP_MAGIC):
        raise StorageError(f"'{filename}' is not a valid Office file.")
    if extension in ("doc", "xls") and not data.startswith(_OLE_MAGIC):
        raise StorageError(
            f"'{filename}' is not a valid legacy Office file. Save it as .docx or .xlsx."
        )
    if extension in ("csv", "txt"):
        if b"\x00" in data[:4096]:
            raise StorageError(f"'{filename}' is not readable text.")
        try:
            data[:4096].decode("utf-8")
        except UnicodeDecodeError:
            raise StorageError(f"'{filename}' must be UTF-8 text.")

    return extension, media_type


def upload_document(data: bytes, folder: str, public_id: str, extension: str) -> dict:
    """Store a validated non-resume document, keeping its own extension."""
    if _is_cloudinary_configured():
        try:
            result = cloudinary.uploader.upload(
                io.BytesIO(data),
                resource_type="raw",
                folder=folder,
                public_id=f"{public_id}.{extension}",
                overwrite=True,
                use_filename=False,
                unique_filename=False,
            )
            return {
                "secure_url": result["secure_url"],
                "public_id": result["public_id"],
                "bytes": result.get("bytes", len(data)),
            }
        except Exception:
            pass

    folder_clean = folder.strip("/").replace("..", "_")
    target_dir = LOCAL_UPLOADS_DIR / folder_clean
    target_dir.mkdir(parents=True, exist_ok=True)

    file_path = target_dir / f"{public_id}.{extension}"
    with open(file_path, "wb") as f:
        f.write(data)

    relative_path = f"{folder_clean}/{public_id}.{extension}"
    return {
        "secure_url": f"/api/v1/uploads/files/{relative_path}",
        "public_id": relative_path,
        "bytes": len(data),
    }


def upload_pdf(data: bytes, folder: str, public_id: str) -> dict:
    """
    Upload a validated PDF buffer to Cloudinary (if configured) or local disk.
    Returns a dict with: secure_url, public_id, bytes.
    """
    if _is_cloudinary_configured():
        try:
            result = cloudinary.uploader.upload(
                io.BytesIO(data),
                resource_type="raw",
                folder=folder,
                public_id=public_id,
                overwrite=True,
                use_filename=False,
                unique_filename=False,
            )
            return {
                "secure_url": result["secure_url"],
                "public_id": result["public_id"],
                "bytes": result.get("bytes", len(data)),
            }
        except Exception as e:
            # Fall back to local storage if Cloudinary upload fails
            pass

    # Local filesystem storage
    folder_clean = folder.strip("/").replace("..", "_")
    target_dir = LOCAL_UPLOADS_DIR / folder_clean
    target_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = target_dir / f"{public_id}.pdf"
    with open(file_path, "wb") as f:
        f.write(data)

    relative_path = f"{folder_clean}/{public_id}.pdf"
    return {
        "secure_url": f"/api/v1/uploads/files/{relative_path}",
        "public_id": relative_path,
        "bytes": len(data),
    }


def get_local_file_path(relative_path: str) -> Path | None:
    """Get absolute path to a local uploaded file if it exists and is within LOCAL_UPLOADS_DIR."""
    clean_path = relative_path.lstrip("/")
    full_path = (LOCAL_UPLOADS_DIR / clean_path).resolve()
    try:
        full_path.relative_to(LOCAL_UPLOADS_DIR.resolve())
    except ValueError:
        return None
    return full_path if full_path.exists() and full_path.is_file() else None


import re

def delete_file(public_id_or_url: str) -> None:
    """Delete a file from Cloudinary or local disk by its public_id or URL."""
    if not public_id_or_url:
        return

    if "/api/v1/uploads/files/" in public_id_or_url:
        rel_path = public_id_or_url.split("/api/v1/uploads/files/")[-1]
        file_path = get_local_file_path(rel_path)
        if file_path and file_path.exists():
            try:
                file_path.unlink()
            except Exception:
                pass
        return

    if _is_cloudinary_configured() and "cloudinary.com" in public_id_or_url:
        match = re.search(r'/upload/(?:v\d+/)?(.+)$', public_id_or_url)
        if match:
            public_id = match.group(1)
            try:
                cloudinary.uploader.destroy(public_id, resource_type="raw")
            except Exception:
                pass
        return

    # Fallback if just a public_id was passed directly (legacy)
    if _is_cloudinary_configured() and not public_id_or_url.endswith(".pdf") and not public_id_or_url.startswith("http"):
        try:
            cloudinary.uploader.destroy(public_id_or_url, resource_type="raw")
        except Exception:
            pass
        return

    file_path = get_local_file_path(public_id_or_url)
    if file_path and file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass

