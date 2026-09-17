"use client";

import {
  Check,
  Download,
  ExternalLink,
  Eye,
  FilePlus,
  FileText,
  GraduationCap,
  IdCard,
  Lock,
  Mail,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  deleteAadhaarDocAction,
  deletePanDocAction,
  deleteResumeAction,
  renameResumeAction,
  deleteCollegeIdDocAction,
  updateAadhaarAction,
  updateCollegeIdAction,
  updatePanAction,
  uploadCollegeIdDocAction,
  updateStudentProfile,
  uploadAadhaarDocAction,
  uploadPanDocAction,
  type ProfileUpdateResult,
} from "@/app/profile/actions";
import { uploadResume } from "@/app/profile/upload-action";
import { IdentityDocumentRow } from "@/components/profile/identity-document-row";
import { BACKLOG_OPTIONS, BLOOD_GROUPS, GENDERS } from "@/lib/profile-schema";

type ProfileValues = {
  name: string;
  rollNumber: string;
  personalEmail: string;
  contactNumber: string;
  altContactNumber: string;
  branch: string;
  degree: string;
  batch: string;
  gender: string;
  bloodGroup: string;
  dateOfBirth: string;
  currentAddress: string;
  class10Percent: string;
  class12Percent: string;
  cgpa: string;
  backlogs: string;
};

export type StudentProfileViewData = {
  canPersist: boolean;
  initials: string;
  completion: number;
  email: string;
  values: ProfileValues;
  identityDocuments: {
    aadhaarProvided: boolean;
    aadhaarMasked?: string | null;
    aadhaarDocProvided?: boolean;
    aadhaarDocFileName?: string | null;
    panProvided: boolean;
    panMasked?: string | null;
    panDocProvided?: boolean;
    panDocFileName?: string | null;
    collegeIdProvided: boolean;
    collegeIdMasked?: string | null;
    collegeIdDocProvided?: boolean;
    collegeIdDocFileName?: string | null;
  };
  resumes: Array<{
    id: string;
    label: string;
    name: string;
    fileUrl: string;
    uploadedAt: string;
  }>;
};

// Set by the placement office from the official roster, not by the student.
// Kept in ProfileValues for display, but renderFields never lets them unlock.
const LOCKED_FIELDS = new Set<keyof ProfileValues>([
  "name",
  "rollNumber",
  "branch",
  "degree",
  "batch",
]);

/**
 * A field descriptor. Supplying `options` renders the shared `.form-grid`
 * select instead of an input, so a new closed-list field is one entry here
 * rather than new markup.
 */
type ProfileField = {
  key: keyof ProfileValues;
  label: string;
  type: string;
  options?: readonly string[];
  /** Native hints for immediate feedback. The schema is what actually decides. */
  step?: string;
  min?: number;
  max?: number;
};

const personalFields: ProfileField[] = [
  { key: "name", label: "Full name", type: "text" },
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
  { key: "gender", label: "Gender", type: "text", options: GENDERS },
  { key: "bloodGroup", label: "Blood group", type: "text", options: BLOOD_GROUPS },
];
const academicFields: ProfileField[] = [
  { key: "rollNumber", label: "Roll number", type: "text" },
  { key: "branch", label: "Branch", type: "text" },
  { key: "degree", label: "Degree", type: "text" },
  { key: "batch", label: "Graduation year", type: "number" },
  { key: "class10Percent", label: "Class 10 %", type: "number", step: "0.01", min: 0, max: 100 },
  { key: "class12Percent", label: "Class 12 %", type: "number", step: "0.01", min: 0, max: 100 },
  { key: "cgpa", label: "Current CGPA", type: "number", step: "0.01", min: 0, max: 10 },
  { key: "backlogs", label: "Active backlogs", type: "number", options: BACKLOG_OPTIONS },
];
const contactFields: ProfileField[] = [
  { key: "personalEmail", label: "Personal email", type: "email" },
  { key: "contactNumber", label: "Phone", type: "tel" },
  { key: "altContactNumber", label: "Alternate phone", type: "tel" },
  { key: "currentAddress", label: "Current address", type: "text" },
];

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function ProfileView({ profile }: { profile: StudentProfileViewData }) {
  const router = useRouter();

  // ── Profile edit state ──────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ProfileUpdateResult>({});
  const [form, setForm] = useState(profile.values);

  // Identity number update modals
  const [aadhaarModal, setAadhaarModal] = useState(false);
  const [aadhaarInput, setAadhaarInput] = useState("");
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);

  const [panModal, setPanModal] = useState(false);
  const [panInput, setPanInput] = useState("");
  const [panError, setPanError] = useState<string | null>(null);

  // Identity doc upload modals
  const [aadhaarDocModal, setAadhaarDocModal] = useState(false);
  const [aadhaarDocError, setAadhaarDocError] = useState<string | null>(null);

  const [panDocModal, setPanDocModal] = useState(false);
  const [panDocError, setPanDocError] = useState<string | null>(null);

  const [collegeIdModal, setCollegeIdModal] = useState(false);
  const [collegeIdInput, setCollegeIdInput] = useState("");
  const [collegeIdError, setCollegeIdError] = useState<string | null>(null);

  const [collegeIdDocModal, setCollegeIdDocModal] = useState(false);
  const [collegeIdDocError, setCollegeIdDocError] = useState<string | null>(null);

  // Unlock identity doc modal
  const [unlockDocModal, setUnlockDocModal] = useState<{
    type: "aadhaar" | "pan" | "college-id";
    label: string;
    fileName: string;
  } | null>(null);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Resume modals & preview
  const [uploadModal, setUploadModal] = useState(false);
  const [resumeLabel, setResumeLabel] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [renameModal, setRenameModal] = useState<{ id: string; currentLabel: string } | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const [previewModal, setPreviewModal] = useState<{ label: string; url: string; filename: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(key: keyof ProfileValues, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !dirty || saving) return;
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    const nextResult = await updateStudentProfile(formData);
    setResult(nextResult);
    setSaving(false);
    if (nextResult.success) {
      setEditing(false);
      setDirty(false);
      router.refresh();
    }
  }

  function handleAadhaarSubmit(e: FormEvent) {
    e.preventDefault();
    setAadhaarError(null);
    const formData = new FormData();
    formData.append("aadhaar", aadhaarInput.replace(/\s+/g, ""));
    startTransition(async () => {
      const res = await updateAadhaarAction(formData);
      if (res.error) {
        setAadhaarError(res.error);
      } else {
        setAadhaarModal(false);
        setAadhaarInput("");
        router.refresh();
      }
    });
  }

  function handlePanSubmit(e: FormEvent) {
    e.preventDefault();
    setPanError(null);
    const formData = new FormData();
    formData.append("pan", panInput.trim().toUpperCase());
    startTransition(async () => {
      const res = await updatePanAction(formData);
      if (res.error) {
        setPanError(res.error);
      } else {
        setPanModal(false);
        setPanInput("");
        router.refresh();
      }
    });
  }

  function handleUploadAadhaarDocSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAadhaarDocError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadAadhaarDocAction(formData);
      if (res.error) {
        setAadhaarDocError(res.error);
      } else {
        setAadhaarDocModal(false);
        router.refresh();
      }
    });
  }

  function handleUploadPanDocSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPanDocError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadPanDocAction(formData);
      if (res.error) {
        setPanDocError(res.error);
      } else {
        setPanDocModal(false);
        router.refresh();
      }
    });
  }

  async function handleUnlockSubmit(e: FormEvent) {
    e.preventDefault();
    if (!unlockDocModal) return;
    setUnlockError(null);
    setUnlocking(true);

    try {
      const res = await fetch(`/api/identity-docs/${unlockDocModal.type}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: unlockInput.trim() }),
      });

      if (!res.ok) {
        let errDetail = "Incorrect number. Document cannot be decrypted.";
        try {
          const json = await res.json();
          if (json.error) errDetail = json.error;
        } catch {}
        setUnlockError(errDetail);
        setUnlocking(false);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewModal({
        label: unlockDocModal.label,
        url: blobUrl,
        filename: unlockDocModal.fileName,
      });
      setUnlockDocModal(null);
      setUnlockInput("");
    } catch {
      setUnlockError("Failed to decrypt document. Please check the entered number.");
    } finally {
      setUnlocking(false);
    }
  }

  function handleDeleteAadhaarDoc() {
    if (!confirm("Are you sure you want to remove the uploaded Aadhaar document?")) return;
    startTransition(async () => {
      await deleteAadhaarDocAction();
      router.refresh();
    });
  }

  function handleCollegeIdSubmit(e: FormEvent) {
    e.preventDefault();
    setCollegeIdError(null);
    const formData = new FormData();
    formData.append("collegeId", collegeIdInput.trim().toUpperCase());
    startTransition(async () => {
      const res = await updateCollegeIdAction(formData);
      if (res.error) {
        setCollegeIdError(res.error);
      } else {
        setCollegeIdModal(false);
        setCollegeIdInput("");
        router.refresh();
      }
    });
  }

  function handleUploadCollegeIdDocSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCollegeIdDocError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadCollegeIdDocAction(formData);
      if (res.error) {
        setCollegeIdDocError(res.error);
      } else {
        setCollegeIdDocModal(false);
        router.refresh();
      }
    });
  }

  function handleDeleteCollegeIdDoc() {
    if (!confirm("Are you sure you want to remove the uploaded College ID document?")) return;
    startTransition(async () => {
      await deleteCollegeIdDocAction();
      router.refresh();
    });
  }

  function handleDeletePanDoc() {
    if (!confirm("Are you sure you want to remove the uploaded PAN document?")) return;
    startTransition(async () => {
      await deletePanDocAction();
      router.refresh();
    });
  }

  function handleUploadResumeSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadResume(formData);
      if (res.error) {
        setUploadError(res.error);
      } else {
        setUploadModal(false);
        setResumeLabel("");
        router.refresh();
      }
    });
  }

  function handleRenameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!renameModal) return;
    setRenameError(null);
    startTransition(async () => {
      const res = await renameResumeAction(renameModal.id, renameInput);
      if (res.error) {
        setRenameError(res.error);
      } else {
        setRenameModal(null);
        setRenameInput("");
        router.refresh();
      }
    });
  }

  function handleDeleteResume(resumeId: string) {
    if (!confirm("Are you sure you want to delete this resume?")) return;
    startTransition(async () => {
      await deleteResumeAction(resumeId);
      router.refresh();
    });
  }

  function renderFields(fields: ProfileField[]) {
    return fields.map(({ key, label, type, options, step, min, max }) => {
      const locked = LOCKED_FIELDS.has(key);
      const error = result.fieldErrors?.[key]?.[0];
      const shared = {
        name: key,
        disabled: locked || !editing,
        value: form[key],
        title: locked ? "Set by the placement office from the official roster" : undefined,
        "aria-invalid": error ? (true as const) : undefined,
        "aria-errormessage": error ? `${key}-error` : undefined,
        onChange: (event: { target: { value: string } }) => update(key, event.target.value),
      };

      return (
        <label className={key === "currentAddress" ? "wide" : ""} key={key}>
          {label}
          {options ? (
            <select {...shared}>
              {/* Every one of these fields is optional, so clearing stays possible. */}
              <option value="">Not provided</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              {...shared}
              type={type}
              step={type === "number" ? (step ?? "any") : undefined}
              min={min}
              max={max}
              placeholder="Not provided"
            />
          )}
          {error ? (
            <small className="field-error" id={`${key}-error`}>
              {error}
            </small>
          ) : null}
        </label>
      );
    });
  }

  return (
    <>
      <form className="module-page profile-page" onSubmit={save}>
        <section className="profile-banner">
          <div className="profile-avatar">{profile.initials}</div>
          <div>
            <span className="eyebrow">Student profile</span>
            <h1>{form.name}</h1>
            <p>
              {form.rollNumber || "Roll number not added"} · {form.branch || "Branch not added"} ·{" "}
              {form.batch ? `Batch of ${form.batch}` : "Batch not added"}
            </p>
          </div>
          <div className="completion">
            <strong>{profile.completion}%</strong>
            <span>Profile complete</span>
            <i>
              <b style={{ width: `${profile.completion}%` }} />
            </i>
          </div>
          {profile.canPersist ? (
            editing ? (
              <button type="submit" disabled={saving || !dirty}>
                <Save />
                {saving ? "Saving…" : dirty ? "Save changes" : "Change a field"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setResult({});
                  setDirty(false);
                  setEditing(true);
                }}
              >
                <Pencil />
                Edit profile
              </button>
            )
          ) : null}
        </section>

        {!profile.canPersist ? (
          <div className="profile-notice">
            Development credential data is intentionally not stored. Sign in with Google to maintain a real profile.
          </div>
        ) : null}
        {result.success ? (
          <div className="save-message">
            <Check />
            {result.success}
          </div>
        ) : null}
        {result.error ? <div className="profile-error">{result.error}</div> : null}

        <section className="profile-grid">
          <article>
            <header>
              <UserRound />
              <div>
                <h2>Personal details</h2>
                <p>Your identity and contact information</p>
              </div>
            </header>
            <div className="form-grid">{renderFields(personalFields)}</div>
          </article>

          <article>
            <header>
              <GraduationCap />
              <div>
                <h2>Academic details</h2>
                <p>Current program and performance</p>
              </div>
            </header>
            <div className="form-grid">{renderFields(academicFields)}</div>
          </article>

          <article>
            <header>
              <Mail />
              <div>
                <h2>Contact information</h2>
                <p>How the placement team reaches you</p>
              </div>
            </header>
            <div className="form-grid">
              <label>
                Institute email
                <input disabled value={profile.email} />
              </label>
              {renderFields(contactFields)}
            </div>
          </article>

          {/* Identity Documents Section */}
          <article className="documents-card">
            <header>
              <IdCard />
              <div>
                <h2>Identity documents</h2>
                <p>Numbers and document files are encrypted at rest with AES-256-GCM</p>
              </div>
            </header>
            <div className="grid gap-3">
              <IdentityDocumentRow
                title="Aadhaar card"
                icon={<IdCard className="size-4.5 shrink-0 text-[color:var(--blue)]" />}
                masked={profile.identityDocuments.aadhaarMasked}
                provided={profile.identityDocuments.aadhaarProvided}
                docProvided={Boolean(profile.identityDocuments.aadhaarDocProvided)}
                docFileName={profile.identityDocuments.aadhaarDocFileName}
                fallbackFileName="aadhaar_card.pdf"
                onEditNumber={() => {
                  setAadhaarError(null);
                  setAadhaarInput("");
                  setAadhaarModal(true);
                }}
                onPreview={() => {
                  setUnlockError(null);
                  setUnlockInput("");
                  setUnlockDocModal({
                    type: "aadhaar",
                    label: "Aadhaar Card Document",
                    fileName: profile.identityDocuments.aadhaarDocFileName || "aadhaar_card.pdf",
                  });
                }}
                onDelete={handleDeleteAadhaarDoc}
                onUpload={() => {
                  setAadhaarDocError(null);
                  setAadhaarDocModal(true);
                }}
              />

              <IdentityDocumentRow
                title="PAN card"
                icon={<FileText className="size-4.5 shrink-0 text-[color:var(--orange)]" />}
                masked={profile.identityDocuments.panMasked}
                provided={profile.identityDocuments.panProvided}
                docProvided={Boolean(profile.identityDocuments.panDocProvided)}
                docFileName={profile.identityDocuments.panDocFileName}
                fallbackFileName="pan_card.pdf"
                onEditNumber={() => {
                  setPanError(null);
                  setPanInput("");
                  setPanModal(true);
                }}
                onPreview={() => {
                  setUnlockError(null);
                  setUnlockInput("");
                  setUnlockDocModal({
                    type: "pan",
                    label: "PAN Card Document",
                    fileName: profile.identityDocuments.panDocFileName || "pan_card.pdf",
                  });
                }}
                onDelete={handleDeletePanDoc}
                onUpload={() => {
                  setPanDocError(null);
                  setPanDocModal(true);
                }}
              />

              <IdentityDocumentRow
                title="College ID card"
                icon={<GraduationCap className="size-4.5 shrink-0 text-[color:var(--navy)]" />}
                masked={profile.identityDocuments.collegeIdMasked}
                provided={profile.identityDocuments.collegeIdProvided}
                docProvided={Boolean(profile.identityDocuments.collegeIdDocProvided)}
                docFileName={profile.identityDocuments.collegeIdDocFileName}
                fallbackFileName="college_id.pdf"
                onEditNumber={() => {
                  setCollegeIdError(null);
                  setCollegeIdInput("");
                  setCollegeIdModal(true);
                }}
                onPreview={() => {
                  setUnlockError(null);
                  setUnlockInput("");
                  setUnlockDocModal({
                    type: "college-id",
                    label: "College ID Card Document",
                    fileName: profile.identityDocuments.collegeIdDocFileName || "college_id.pdf",
                  });
                }}
                onDelete={handleDeleteCollegeIdDoc}
                onUpload={() => {
                  setCollegeIdDocError(null);
                  setCollegeIdDocModal(true);
                }}
              />
            </div>
          </article>

          {/* Resumes Section */}
          <article className="resumes-card" style={{ gridColumn: "1 / -1" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FileText />
                <div>
                  <h2>Resumes</h2>
                  <p>Upload, manage, and preview your PDF resumes for applications</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUploadError(null);
                  setResumeLabel("");
                  setUploadModal(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "var(--navy)",
                  color: "#fff",
                  border: 0,
                  borderRadius: "8px",
                  padding: "8px 14px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <FilePlus style={{ width: "14px", height: "14px" }} />
                Upload Resume
              </button>
            </header>

            <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
              {profile.resumes.length ? (
                profile.resumes.map((resume) => (
                  <div
                    key={resume.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "var(--surface-alt)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          padding: "8px",
                          borderRadius: "8px",
                          background: "var(--badge-blue-bg)",
                          color: "var(--blue)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <FileText style={{ width: "16px", height: "16px" }} />
                      </div>
                      <div>
                        <strong style={{ fontSize: "12px", display: "block", color: "var(--ink)" }}>
                          {resume.label}
                        </strong>
                        <small style={{ fontSize: "10px", color: "var(--muted)" }}>
                          {resume.name} · Uploaded{" "}
                          {new Intl.DateTimeFormat("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(resume.uploadedAt))}
                        </small>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewModal({
                            label: resume.label,
                            url: resume.fileUrl,
                            filename: resume.name,
                          })
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "var(--badge-blue-bg)",
                          color: "var(--badge-blue-text)",
                          border: "1px solid var(--blue)",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                        title="Preview PDF"
                      >
                        <Eye style={{ width: "13px", height: "13px" }} />
                        Preview
                      </button>

                      {/* Rename Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setRenameError(null);
                          setRenameInput(resume.label);
                          setRenameModal({ id: resume.id, currentLabel: resume.label });
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "var(--card-bg)",
                          color: "var(--ink)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                        title="Rename resume"
                      >
                        <Pencil style={{ width: "13px", height: "13px" }} />
                        Rename
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteResume(resume.id)}
                        disabled={isPending}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "var(--badge-red-bg)",
                          color: "var(--badge-red-text)",
                          border: "1px solid var(--badge-red-text)",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                        title="Delete resume"
                      >
                        <Trash2 style={{ width: "13px", height: "13px" }} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty" style={{ padding: "30px 15px", textAlign: "center" }}>
                  <FileText style={{ margin: "0 auto 8px", color: "var(--muted)", width: "24px" }} />
                  <h3 style={{ fontSize: "13px", color: "var(--ink)", margin: 0 }}>No resumes uploaded yet</h3>
                  <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 12px" }}>
                    Upload your customized PDF resumes to easily apply to campus recruitment drives.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadError(null);
                      setResumeLabel("");
                      setUploadModal(true);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "var(--navy)",
                      color: "#fff",
                      border: 0,
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Plus style={{ width: "13px", height: "13px" }} />
                    Upload First Resume
                  </button>
                </div>
              )}
            </div>
          </article>
        </section>
      </form>

      {/* Aadhaar Number Update Modal */}
      {aadhaarModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleAadhaarSubmit} style={{ maxWidth: "420px" }}>
            <header>
              <div>
                <span className="eyebrow">Identity Document</span>
                <h2>Update Aadhaar Card Number</h2>
              </div>
              <button type="button" onClick={() => setAadhaarModal(false)} aria-label="Close modal">
                <X />
              </button>
            </header>
            <div style={{ padding: "16px 0", display: "grid", gap: "12px" }}>
              {aadhaarError && (
                <div
                  style={{
                    color: "var(--badge-red-text)",
                    background: "var(--badge-red-bg)",
                    border: "1px solid var(--badge-red-text)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {aadhaarError}
                </div>
              )}
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                12-digit Aadhaar Number
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={12}
                  value={aadhaarInput}
                  placeholder=""
                  onChange={(e) => setAadhaarInput(e.target.value.replace(/[^0-9]/g, ""))}
                  required
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "13px",
                    letterSpacing: "1px",
                  }}
                />
              </label>
              <p style={{ fontSize: "10px", color: "var(--muted)", margin: 0 }}>
                Aadhaar is encrypted using AES-256-GCM and never shared in plaintext.
              </p>
            </div>
            <footer>
              <button type="button" onClick={() => setAadhaarModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isPending || aadhaarInput.length !== 12}>
                <Save />
                {isPending ? "Saving..." : "Save Aadhaar"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* PAN Number Update Modal */}
      {panModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handlePanSubmit} style={{ maxWidth: "420px" }}>
            <header>
              <div>
                <span className="eyebrow">Identity Document</span>
                <h2>Update PAN Card Number</h2>
              </div>
              <button type="button" onClick={() => setPanModal(false)} aria-label="Close modal">
                <X />
              </button>
            </header>
            <div style={{ padding: "16px 0", display: "grid", gap: "12px" }}>
              {panError && (
                <div
                  style={{
                    color: "var(--badge-red-text)",
                    background: "var(--badge-red-bg)",
                    border: "1px solid var(--badge-red-text)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {panError}
                </div>
              )}
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                10-character PAN
                <input
                  type="text"
                  maxLength={10}
                  value={panInput}
                  placeholder=""
                  onChange={(e) => setPanInput(e.target.value.toUpperCase())}
                  required
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "13px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                  }}
                />
              </label>
              <p style={{ fontSize: "10px", color: "var(--muted)", margin: 0 }}>
                PAN is encrypted using AES-256-GCM and stored securely.
              </p>
            </div>
            <footer>
              <button type="button" onClick={() => setPanModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isPending || panInput.length !== 10}>
                <Save />
                {isPending ? "Saving..." : "Save PAN"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Upload Aadhaar Document File Modal */}
      {aadhaarDocModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleUploadAadhaarDocSubmit} style={{ maxWidth: "460px" }}>
            <header>
              <div>
                <span className="eyebrow">Encrypted Document Upload</span>
                <h2>Upload Aadhaar Card Document</h2>
              </div>
              <button type="button" onClick={() => setAadhaarDocModal(false)} aria-label="Close modal">
                <X />
              </button>
            </header>
            <div style={{ padding: "16px 0", display: "grid", gap: "14px" }}>
              {aadhaarDocError && (
                <div
                  style={{
                    color: "var(--badge-red-text)",
                    background: "var(--badge-red-bg)",
                    border: "1px solid var(--badge-red-text)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {aadhaarDocError}
                </div>
              )}
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                Confirm 12-digit Aadhaar Number
                <input
                  name="aadhaar"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={12}
                  placeholder=""
                  required
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "13px",
                    letterSpacing: "1px",
                  }}
                />
              </label>

              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                Aadhaar PDF Document (Max 5MB)
                <input
                  name="file"
                  type="file"
                  accept="application/pdf"
                  required
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "11px",
                  }}
                />
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "var(--badge-blue-bg)",
                  color: "var(--badge-blue-text)",
                  fontSize: "10px",
                }}
              >
                <ShieldCheck style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "2px" }} />
                <span>
                  The document file is encrypted with AES-256-GCM before saving and can only be unlocked by entering your full 12-digit Aadhaar number.
                </span>
              </div>
            </div>
            <footer>
              <button type="button" onClick={() => setAadhaarDocModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isPending}>
                <UploadCloud />
                {isPending ? "Encrypting & Uploading..." : "Upload & Encrypt"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Upload PAN Document File Modal */}
      {panDocModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleUploadPanDocSubmit} style={{ maxWidth: "460px" }}>
            <header>
              <div>
                <span className="eyebrow">Encrypted Document Upload</span>
                <h2>Upload PAN Card Document</h2>
              </div>
              <button type="button" onClick={() => setPanDocModal(false)} aria-label="Close modal">
                <X />
              </button>
            </header>
            <div style={{ padding: "16px 0", display: "grid", gap: "14px" }}>
              {panDocError && (
                <div
                  style={{
                    color: "var(--badge-red-text)",
                    background: "var(--badge-red-bg)",
                    border: "1px solid var(--badge-red-text)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {panDocError}
                </div>
              )}
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                Confirm 10-character PAN
                <input
                  name="pan"
                  type="text"
                  maxLength={10}
                  placeholder=""
                  required
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "13px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                  }}
                />
              </label>

              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                PAN PDF Document (Max 5MB)
                <input
                  name="file"
                  type="file"
                  accept="application/pdf"
                  required
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "11px",
                  }}
                />
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "var(--badge-blue-bg)",
                  color: "var(--badge-blue-text)",
                  fontSize: "10px",
                }}
              >
                <ShieldCheck style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "2px" }} />
                <span>
                  The document file is encrypted with AES-256-GCM before saving and can only be unlocked by entering your full 10-character PAN.
                </span>
              </div>
            </div>
            <footer>
              <button type="button" onClick={() => setPanDocModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isPending}>
                <UploadCloud />
                {isPending ? "Encrypting & Uploading..." : "Upload & Encrypt"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* College ID number */}
      {collegeIdModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleCollegeIdSubmit} style={{ maxWidth: "420px" }}>
            <header>
              <div>
                <span className="eyebrow">Identity Document</span>
                <h2>Update College ID Number</h2>
              </div>
              <button type="button" onClick={() => setCollegeIdModal(false)} aria-label="Close modal">
                <X />
              </button>
            </header>
            <div style={{ padding: "16px 0", display: "grid", gap: "12px" }}>
              {collegeIdError && (
                <div style={{
                    color: "var(--badge-red-text)",
                    background: "var(--badge-red-bg)",
                    border: "1px solid var(--badge-red-text)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}>{collegeIdError}</div>
              )}
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                College ID number
                <input
                  type="text"
                  maxLength={20}
                  value={collegeIdInput}
                  onChange={(e) => setCollegeIdInput(e.target.value.toUpperCase())}
                  required
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "13px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                  }}
                />
              </label>
              <p style={{ fontSize: "10px", color: "var(--muted)", margin: 0 }}>
                Usually your roll number as printed on the card. It is encrypted using
                AES-256-GCM and doubles as the challenge that unlocks the scan.
              </p>
            </div>
            <footer>
              <button type="button" onClick={() => setCollegeIdModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isPending || collegeIdInput.trim().length < 4}>
                <Save />
                {isPending ? "Saving..." : "Save College ID"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Upload College ID Document File Modal */}
      {collegeIdDocModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleUploadCollegeIdDocSubmit} style={{ maxWidth: "460px" }}>
            <header>
              <div>
                <span className="eyebrow">Encrypted Document Upload</span>
                <h2>Upload College ID Card</h2>
              </div>
              <button type="button" onClick={() => setCollegeIdDocModal(false)} aria-label="Close modal">
                <X />
              </button>
            </header>
            <div style={{ padding: "16px 0", display: "grid", gap: "14px" }}>
              {collegeIdDocError && (
                <div style={{
                    color: "var(--badge-red-text)",
                    background: "var(--badge-red-bg)",
                    border: "1px solid var(--badge-red-text)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}>{collegeIdDocError}</div>
              )}
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                Confirm College ID number
                <input
                  name="collegeId"
                  type="text"
                  maxLength={20}
                  required
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "13px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                  }}
                />
              </label>

              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                College ID PDF Document (Max 5MB)
                <input
                  name="file"
                  type="file"
                  accept="application/pdf"
                  required
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "11px",
                  }}
                />
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "var(--badge-blue-bg)",
                  color: "var(--badge-blue-text)",
                  fontSize: "10px",
                }}
              >
                <ShieldCheck style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "2px" }} />
                <span>
                  The document file is encrypted with AES-256-GCM before saving and can only be
                  unlocked by entering your College ID number.
                </span>
              </div>
            </div>
            <footer>
              <button type="button" onClick={() => setCollegeIdDocModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isPending}>
                <UploadCloud />
                {isPending ? "Encrypting & Uploading..." : "Upload & Encrypt"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Security Unlock Challenge Modal */}
      {unlockDocModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleUnlockSubmit} style={{ maxWidth: "440px" }}>
            <header>
              <div>
                <span className="eyebrow">Security Challenge</span>
                <h2>Unlock {unlockDocModal.label}</h2>
              </div>
              <button type="button" onClick={() => setUnlockDocModal(null)} aria-label="Close challenge">
                <X />
              </button>
            </header>
            <div style={{ padding: "16px 0", display: "grid", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px",
                  background: "var(--surface-alt)",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                }}
              >
                <Lock style={{ width: "20px", height: "20px", color: "var(--navy)" }} />
                <div>
                  <strong style={{ fontSize: "11px", display: "block", color: "var(--ink)" }}>
                    End-to-End Encrypted File
                  </strong>
                  <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                    {unlockDocModal.fileName}
                  </span>
                </div>
              </div>

              {unlockError && (
                <div
                  style={{
                    color: "var(--badge-red-text)",
                    background: "var(--badge-red-bg)",
                    border: "1px solid var(--badge-red-text)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {unlockError}
                </div>
              )}

              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                Enter the full{" "}
                {unlockDocModal.type === "aadhaar"
                  ? "12-digit Aadhaar number"
                  : unlockDocModal.type === "pan"
                    ? "10-character PAN"
                    : "College ID number"}{" "}
                to decrypt
                <input
                  type="text"
                  inputMode={unlockDocModal.type === "aadhaar" ? "numeric" : "text"}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={
                    unlockDocModal.type === "aadhaar" ? 12 : unlockDocModal.type === "pan" ? 10 : 20
                  }
                  value={unlockInput}
                  placeholder=""
                  onChange={(e) =>
                    setUnlockInput(
                      unlockDocModal.type === "aadhaar"
                        ? e.target.value.replace(/[^0-9]/g, "")
                        : e.target.value.toUpperCase()
                    )
                  }
                  required
                  autoFocus
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "13px",
                    letterSpacing: "2px",
                  }}
                />
              </label>
              <p style={{ fontSize: "10px", color: "var(--muted)", margin: 0 }}>
                This security verification prevents unauthorized viewing and decrypts the document on-demand in memory.
              </p>
            </div>
            <footer>
              <button type="button" onClick={() => setUnlockDocModal(null)}>
                Cancel
              </button>
              <button type="submit" disabled={unlocking || !unlockInput.trim()}>
                <ShieldCheck />
                {unlocking ? "Decrypting..." : "Decrypt & Preview"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Upload Resume Modal */}
      {uploadModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleUploadResumeSubmit} style={{ maxWidth: "460px" }}>
            <header>
              <div>
                <span className="eyebrow">Career Documents</span>
                <h2>Upload Resume</h2>
              </div>
              <button type="button" onClick={() => setUploadModal(false)} aria-label="Close modal">
                <X />
              </button>
            </header>
            <div style={{ padding: "16px 0", display: "grid", gap: "14px" }}>
              {uploadError && (
                <div
                  style={{
                    color: "var(--badge-red-text)",
                    background: "var(--badge-red-bg)",
                    border: "1px solid var(--badge-red-text)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {uploadError}
                </div>
              )}
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                Resume Label
                <input
                  name="label"
                  type="text"
                  placeholder="e.g. SDE Resume / Backend Profile"
                  value={resumeLabel}
                  onChange={(e) => setResumeLabel(e.target.value)}
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "12px",
                  }}
                />
              </label>

              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                PDF File (Max 5MB)
                <input
                  name="file"
                  type="file"
                  accept="application/pdf"
                  required
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "11px",
                  }}
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setUploadModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isPending}>
                <UploadCloud />
                {isPending ? "Uploading..." : "Upload"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Rename Resume Modal */}
      {renameModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleRenameSubmit} style={{ maxWidth: "420px" }}>
            <header>
              <div>
                <span className="eyebrow">Manage Resume</span>
                <h2>Rename Resume Label</h2>
              </div>
              <button type="button" onClick={() => setRenameModal(null)} aria-label="Close modal">
                <X />
              </button>
            </header>
            <div style={{ padding: "16px 0", display: "grid", gap: "12px" }}>
              {renameError && (
                <div
                  style={{
                    color: "var(--badge-red-text)",
                    background: "var(--badge-red-bg)",
                    border: "1px solid var(--badge-red-text)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {renameError}
                </div>
              )}
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "grid", gap: "6px" }}>
                New Label
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  required
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--ink)",
                    fontSize: "12px",
                  }}
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setRenameModal(null)}>
                Cancel
              </button>
              <button type="submit" disabled={isPending || !renameInput.trim()}>
                <Save />
                {isPending ? "Saving..." : "Update Label"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewModal && (
        <div className="modal-backdrop">
          <div className="modal doc-preview-modal">
            <header className="preview-header">
              <div>
                <span className="eyebrow">Document Preview</span>
                <h2>{previewModal.label}</h2>
                <small style={{ color: "var(--muted)", fontSize: "11px", display: "block", marginTop: "2px" }}>
                  {previewModal.filename}
                </small>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <a
                  href={previewModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--blue)",
                    textDecoration: "none",
                  }}
                  title="Open in new window"
                >
                  <ExternalLink style={{ width: "13px", height: "13px" }} />
                  New Tab
                </a>
                <a
                  href={previewModal.url}
                  download={previewModal.filename}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--navy)",
                    textDecoration: "none",
                  }}
                  title="Download PDF"
                >
                  <Download style={{ width: "13px", height: "13px" }} />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  aria-label="Close preview"
                  style={{ border: 0, background: "transparent", cursor: "pointer" }}
                >
                  <X />
                </button>
              </div>
            </header>

            <div className="preview-frame-container">
              <iframe
                src={`${previewModal.url}#toolbar=1&navpanes=0`}
                title="Document PDF Preview"
              />
            </div>

            <footer>
              <button type="button" onClick={() => setPreviewModal(null)}>
                Close Preview
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}



