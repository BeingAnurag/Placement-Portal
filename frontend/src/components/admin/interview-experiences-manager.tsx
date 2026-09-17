"use client";

import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock3,
  Eye,
  MessageSquareText,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  approveInterviewExperienceAction,
  deleteInterviewExperienceAction,
  rejectInterviewExperienceAction,
  type InterviewExperienceActionResult,
} from "@/app/admin/interview-experiences/actions";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";

const QUESTION_SECTIONS: { key: string; label: string }[] = [
  { key: "dsaQuestions", label: "DSA questions asked" },
  { key: "codingQuestions", label: "Coding question(s) asked" },
  { key: "oopsQuestions", label: "OOPS questions" },
  { key: "dbmsQuestions", label: "DBMS questions" },
  { key: "sqlQuestions", label: "SQL questions" },
  { key: "osQuestions", label: "Operating System questions" },
  { key: "cnQuestions", label: "Computer Networks questions" },
  { key: "systemDesignQuestions", label: "System Design / LLD / HLD" },
  { key: "csFundamentalsQuestions", label: "CS Fundamentals / Misc" },
  { key: "resumeQuestions", label: "Resume-based questions" },
  { key: "projectsDiscussed", label: "Projects discussed" },
  { key: "aptitudeQuestions", label: "Puzzle / Aptitude questions" },
  { key: "hrQuestions", label: "HR questions" },
  { key: "behavioralQuestions", label: "Behavioral questions" },
  { key: "unansweredQuestions", label: "Questions the student couldn't answer" },
  { key: "resources", label: "Resources that helped" },
  { key: "tips", label: "Tips for future candidates" },
];

export type AdminInterviewExperienceItem = {
  id: string;
  userId: string;
  companyName: string;
  role: string;
  batch: number;
  interviewType: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  reviewNote?: string | null;
  createdAt: string;
  author?: {
    id: string;
    name?: string | null;
    email?: string | null;
    rollNumber?: string | null;
    branch?: string | null;
    batch?: number | null;
  } | null;
  [key: string]: unknown;
};

export function InterviewExperiencesManager({ experiences }: { experiences: AdminInterviewExperienceItem[] }) {
  const router = useRouter();
  const [detailItem, setDetailItem] = useState<AdminInterviewExperienceItem | null>(null);
  const [rejectingItem, setRejectingItem] = useState<AdminInterviewExperienceItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<AdminInterviewExperienceItem | null>(null);
  const [result, setResult] = useState<InterviewExperienceActionResult>({});
  const [isPending, startTransition] = useTransition();

  const metrics = useMemo(() => {
    const total = experiences.length;
    const pending = experiences.filter((e) => e.status === "PENDING").length;
    const approved = experiences.filter((e) => e.status === "APPROVED").length;
    const rejected = experiences.filter((e) => e.status === "REJECTED").length;
    return { total, pending, approved, rejected };
  }, [experiences]);

  function handleApprove(item: AdminInterviewExperienceItem) {
    setResult({});
    startTransition(async () => {
      const formData = new FormData();
      formData.append("experienceId", item.id);
      const res = await approveInterviewExperienceAction(formData);
      setResult(res);
      if (res.success) router.refresh();
    });
  }

  function handleReject(formData: FormData) {
    setResult({});
    startTransition(async () => {
      const res = await rejectInterviewExperienceAction(formData);
      setResult(res);
      if (res.success) {
        setRejectingItem(null);
        router.refresh();
      }
    });
  }

  function handleDelete(formData: FormData) {
    setResult({});
    startTransition(async () => {
      const res = await deleteInterviewExperienceAction(formData);
      setResult(res);
      if (res.success) {
        setDeletingItem(null);
        router.refresh();
      }
    });
  }

  const columns = useMemo<DataTableColumn<AdminInterviewExperienceItem>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        width: "minmax(200px, 1.8fr)",
        hideable: false,
        sortValue: (item) => item.author?.name || item.author?.rollNumber || item.author?.email,
        cell: (item) => (
          <>
            <strong style={{ color: "var(--ink)", fontWeight: 700 }}>
              {item.author?.name || item.author?.rollNumber || "Student"}
            </strong>
            <small style={{ color: "var(--muted)", display: "block", fontSize: "10px" }}>
              {[item.author?.rollNumber, item.author?.branch, item.author?.batch ? `Batch ${item.author.batch}` : null]
                .filter(Boolean)
                .join(" · ") || item.author?.email}
            </small>
          </>
        ),
      },
      {
        id: "company",
        header: "Company & role",
        width: "minmax(180px, 1.6fr)",
        sortValue: (item) => item.companyName,
        cell: (item) => (
          <>
            <strong style={{ color: "var(--ink)" }}>{item.companyName}</strong>
            <small style={{ color: "var(--muted)", display: "block", fontSize: "10px" }}>{item.role}</small>
          </>
        ),
      },
      {
        id: "interviewType",
        header: "Type",
        width: "minmax(120px, 1fr)",
        sortValue: (item) => item.interviewType,
        cell: (item) => <span style={{ fontSize: "11px" }}>{item.interviewType}</span>,
      },
      {
        id: "status",
        header: "Status",
        width: "minmax(120px, 1fr)",
        sortValue: (item) => item.status,
        cell: (item) => (
          <>
            {item.status === "PENDING" && (
              <span className="cell-status pending" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Clock3 size={11} /> Pending
              </span>
            )}
            {item.status === "APPROVED" && (
              <span className="cell-status" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <CheckCircle2 size={11} /> Live
              </span>
            )}
            {item.status === "REJECTED" && (
              <span
                className="cell-status"
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "var(--badge-red-bg)", color: "var(--badge-red-text)" }}
              >
                <XCircle size={11} /> Rejected
              </span>
            )}
          </>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        width: "260px",
        align: "right",
        hideable: false,
        cell: (item) => (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setDetailItem(item)}
              title="View full submission"
              style={{
                border: 0,
                background: "var(--surface-alt)",
                color: "var(--blue)",
                borderRadius: "8px",
                padding: "6px 9px",
                fontSize: "11px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
              }}
            >
              <Eye size={13} /> Details
            </button>

            {item.status === "PENDING" && (
              <>
                <button
                  type="button"
                  onClick={() => handleApprove(item)}
                  disabled={isPending}
                  title="Approve and publish"
                  style={{
                    border: 0,
                    background: "var(--badge-green-bg)",
                    color: "var(--green)",
                    borderRadius: "8px",
                    padding: "6px 9px",
                    fontSize: "11px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <CheckCircle2 size={13} /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResult({});
                    setRejectingItem(item);
                  }}
                  title="Reject submission"
                  style={{
                    border: 0,
                    background: "var(--badge-red-bg)",
                    color: "var(--badge-red-text)",
                    borderRadius: "8px",
                    padding: "6px 9px",
                    fontSize: "11px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <XCircle size={13} /> Reject
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setResult({});
                setDeletingItem(item);
              }}
              title="Delete submission"
              aria-label={`Delete submission for ${item.companyName}`}
              style={{
                border: 0,
                background: "var(--surface-alt)",
                color: "var(--muted)",
                borderRadius: "8px",
                padding: "6px 9px",
                fontSize: "11px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    // The handlers are redefined per render but close over nothing that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPending],
  );

  const filters = useMemo<DataTableFilter<AdminInterviewExperienceItem>[]>(
    () => [
      {
        id: "status",
        label: "Status",
        options: [
          { value: "PENDING", label: `Pending review (${metrics.pending})` },
          { value: "APPROVED", label: `Live (${metrics.approved})` },
          { value: "REJECTED", label: `Rejected (${metrics.rejected})` },
        ],
        value: (item) => item.status,
      },
    ],
    [metrics],
  );

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Moderation</span>
          <h1>Interview Experiences</h1>
          <p>Review student-submitted interview experiences before they are published to the community.</p>
        </div>
      </section>

      <section className="admin-metrics">
        <article>
          <div className="metric-icon violet">
            <MessageSquareText size={20} />
          </div>
          <div>
            <small>Total submissions</small>
            <strong>{metrics.total}</strong>
            <b>All-time student contributions</b>
          </div>
        </article>
        <article>
          <div className="metric-icon" style={{ background: "var(--badge-orange-bg)", color: "var(--badge-orange-text)" }}>
            <Clock3 size={20} />
          </div>
          <div>
            <small>Pending review</small>
            <strong>{metrics.pending}</strong>
            <b>Awaiting decision</b>
          </div>
        </article>
        <article>
          <div className="metric-icon" style={{ background: "var(--badge-green-bg)", color: "var(--badge-green-text)" }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <small>Live</small>
            <strong>{metrics.approved}</strong>
            <b>Visible to students</b>
          </div>
        </article>
        <article>
          <div className="metric-icon" style={{ background: "var(--badge-red-bg)", color: "var(--badge-red-text)" }}>
            <XCircle size={20} />
          </div>
          <div>
            <small>Rejected</small>
            <strong>{metrics.rejected}</strong>
            <b>Not published</b>
          </div>
        </article>
      </section>

      {result.success && <div className="admin-success">{result.success}</div>}
      {result.error && <div className="admin-error">{result.error}</div>}

      <DataTable
        data={experiences}
        columns={columns}
        getRowId={(item) => item.id}
        searchText={(item) =>
          `${item.author?.name ?? ""} ${item.author?.rollNumber ?? ""} ${item.companyName} ${item.role}`
        }
        searchPlaceholder="Search by student name, roll number, company, role..."
        filters={filters}
        // This screen is a moderation queue, so it opens on what is waiting.
        initialFilters={{ status: ["PENDING"] }}
        columnStorageKey="interview-experiences"
        minWidth={1020}
        emptyIcon={<MessageSquareText />}
        emptyTitle="No interview experiences found"
        emptyDescription={
          experiences.length
            ? "No submissions match your search filter."
            : "No submissions in this status yet."
        }
      />

      {/* Details modal */}
      {detailItem && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "680px", maxHeight: "88vh", overflowY: "auto" }}>
            <header>
              <div>
                <span className="eyebrow">Inspection</span>
                <h2>{detailItem.companyName}</h2>
              </div>
              <button type="button" onClick={() => setDetailItem(null)} aria-label="Close">
                <X />
              </button>
            </header>

            <div style={{ display: "grid", gap: "12px", margin: "14px 0", fontSize: "12px" }}>
              <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px" }}>
                <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Student</span>
                <strong style={{ display: "block", marginTop: "4px" }}>{detailItem.author?.name || "Name not recorded"}</strong>
                <small style={{ color: "var(--muted)" }}>
                  {[detailItem.author?.rollNumber, detailItem.author?.branch, detailItem.author?.batch].filter(Boolean).join(" · ")}
                </small>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 14px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    <Briefcase size={12} /> Role
                  </span>
                  <strong style={{ display: "block", marginTop: "4px" }}>{detailItem.role}</strong>
                </div>
                <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 14px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    <Calendar size={12} /> Batch & type
                  </span>
                  <strong style={{ display: "block", marginTop: "4px" }}>
                    {detailItem.batch} · {detailItem.interviewType}
                  </strong>
                </div>
              </div>

              {QUESTION_SECTIONS.filter((s) => detailItem[s.key]).map((section) => (
                <div key={section.key} style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px" }}>
                  <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>{section.label}</span>
                  <p style={{ margin: "6px 0 0", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{String(detailItem[section.key])}</p>
                </div>
              ))}

              {detailItem.reviewNote && (
                <div style={{ background: "var(--badge-orange-bg)", border: "1px solid var(--badge-orange-text)", borderRadius: "10px", padding: "10px 14px" }}>
                  <span style={{ fontSize: "10px", color: "var(--badge-orange-text)", textTransform: "uppercase", fontWeight: 700 }}>Review note</span>
                  <p style={{ margin: "6px 0 0" }}>{detailItem.reviewNote}</p>
                </div>
              )}
            </div>

            <footer>
              <button type="button" onClick={() => setDetailItem(null)}>
                Close
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectingItem && (
        <div className="modal-backdrop">
          <form className="modal" style={{ maxWidth: "520px" }} onSubmit={(e) => { e.preventDefault(); handleReject(new FormData(e.currentTarget)); }}>
            <input type="hidden" name="experienceId" value={rejectingItem.id} />
            <header>
              <div>
                <span className="eyebrow" style={{ color: "var(--badge-red-text)" }}>Decision</span>
                <h2>Reject submission</h2>
              </div>
              <button type="button" onClick={() => setRejectingItem(null)} aria-label="Close">
                <X />
              </button>
            </header>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "10px 0" }}>
              Rejecting the interview experience for <strong>{rejectingItem.companyName}</strong> submitted by{" "}
              <strong>{rejectingItem.author?.name || rejectingItem.author?.rollNumber}</strong>. An optional note will be shared with the student.
            </p>
            <div style={{ margin: "14px 0" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", display: "grid", gap: "4px" }}>
                Reviewer note (optional)
                <textarea
                  name="reviewNote"
                  rows={3}
                  placeholder="e.g. Please avoid sharing proprietary questions verbatim..."
                  style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "8px 12px", background: "var(--input-bg)", color: "var(--ink)", fontSize: "12px" }}
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setRejectingItem(null)}>
                Cancel
              </button>
              <button type="submit" disabled={isPending} style={{ background: "var(--badge-red-text)", color: "#fff" }}>
                <XCircle size={14} />
                {isPending ? "Rejecting..." : "Confirm rejection"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingItem && (
        <div className="modal-backdrop">
          <form className="modal" style={{ maxWidth: "460px" }} onSubmit={(e) => { e.preventDefault(); handleDelete(new FormData(e.currentTarget)); }}>
            <input type="hidden" name="experienceId" value={deletingItem.id} />
            <header>
              <div>
                <span className="eyebrow" style={{ color: "var(--badge-red-text)" }}>Delete</span>
                <h2>Delete this submission?</h2>
              </div>
              <button type="button" onClick={() => setDeletingItem(null)} aria-label="Close">
                <X />
              </button>
            </header>
            <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: "1.6", margin: "14px 0" }}>
              This will permanently remove the interview experience for <strong>{deletingItem.companyName}</strong>. This action cannot be undone.
            </p>
            <footer>
              <button type="button" onClick={() => setDeletingItem(null)}>
                Keep it
              </button>
              <button type="submit" disabled={isPending} style={{ background: "var(--badge-red-text)", color: "#fff" }}>
                <Trash2 size={13} />
                {isPending ? "Deleting..." : "Yes, delete"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
