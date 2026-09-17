"""Attachment validation for announcements.

The rule these cover: an attachment is accepted on its bytes, not on its name,
so a renamed file cannot smuggle a type past the closed list.
"""
import pytest

from app.core.storage import ATTACHMENT_TYPES, StorageError, validate_attachment

PDF = b"%PDF-1.7\n% test"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16
ZIP = b"PK\x03\x04" + b"\x00" * 16
OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 16


def test_accepts_every_listed_type():
    cases = [
        ("shortlist.pdf", PDF, "application/pdf"),
        ("venue.png", PNG, "image/png"),
        ("poster.jpg", JPEG, "image/jpeg"),
        ("poster.jpeg", JPEG, "image/jpeg"),
        ("roll-numbers.csv", b"roll,name\n2101,Isha\n", "text/csv"),
        ("notes.txt", b"Report at 9 am.", "text/plain"),
        ("offer.doc", OLE, "application/msword"),
        ("offer.docx", ZIP, ATTACHMENT_TYPES["docx"]),
        ("marks.xls", OLE, "application/vnd.ms-excel"),
        ("marks.xlsx", ZIP, ATTACHMENT_TYPES["xlsx"]),
    ]
    for name, data, expected_type in cases:
        extension, media_type = validate_attachment(data, name, 10)
        assert media_type == expected_type
        assert name.endswith(extension)


def test_rejects_a_type_outside_the_list():
    with pytest.raises(StorageError) as error:
        validate_attachment(b"MZ\x90\x00", "payload.exe", 10)
    assert "not an accepted file type" in str(error.value)


def test_rejects_a_file_with_no_extension():
    with pytest.raises(StorageError):
        validate_attachment(PDF, "shortlist", 10)


def test_rejects_content_that_contradicts_the_extension():
    # An executable renamed to .pdf is the case that matters.
    with pytest.raises(StorageError) as error:
        validate_attachment(b"MZ\x90\x00" + b"\x00" * 32, "shortlist.pdf", 10)
    assert "not a valid PDF" in str(error.value)

    with pytest.raises(StorageError):
        validate_attachment(PDF, "venue.png", 10)

    with pytest.raises(StorageError):
        validate_attachment(PDF, "marks.xlsx", 10)


def test_rejects_binary_dressed_as_text():
    with pytest.raises(StorageError) as error:
        validate_attachment(b"roll,name\n\x00\x01\x02", "list.csv", 10)
    assert "not readable text" in str(error.value)


def test_rejects_text_that_is_not_utf8():
    with pytest.raises(StorageError) as error:
        validate_attachment(b"roll\xff\xfename", "list.txt", 10)
    assert "UTF-8" in str(error.value)


def test_rejects_an_empty_file():
    with pytest.raises(StorageError) as error:
        validate_attachment(b"", "shortlist.pdf", 10)
    assert "empty" in str(error.value)


def test_rejects_a_file_over_the_limit():
    oversized = PDF + b"0" * (2 * 1024 * 1024)
    with pytest.raises(StorageError) as error:
        validate_attachment(oversized, "shortlist.pdf", 1)
    assert "1 MB limit" in str(error.value)


def test_extension_matching_ignores_case():
    extension, media_type = validate_attachment(PDF, "Shortlist.PDF", 10)
    assert extension == "pdf"
    assert media_type == "application/pdf"
