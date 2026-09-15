"use client";

import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock3,
  Eye,
  MessageSquareText,
  Search,
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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
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

  const visible = useMemo(() => {
    return experiences.filter((item) => {
      const matchesSearch = `${item.author?.name ?? ""} ${item.author?.rollNumber ?? ""} ${item.companyName} ${item.role}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [experiences, query, statusFilter]);

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

      <div className="admin-toolbar">
        <label>
          <Search />
          <input
            type="search"
            placeholder="Search by student name, roll number, company, role..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | "PENDING" | "APPROVED" | "REJECTED")}
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses ({experiences.length})</option>
          <option value="PENDING">Pending review ({metrics.pending})</option>
          <option value="APPROVED">Live ({metrics.approved})</option>
          <option value="REJECTED">Rejected ({metrics.rejected})</option>
        </select>
      </div>

      <section className="admin-table">
        <div className="admin-row admin-row-head" style={{ gridTemplateColumns: "1.8fr 1.6fr 1fr 1fr 1.6fr" }}>
          <span>Student</span>
          <span>Company & role</span>
          <span>Type</span>
          <span>Status</span>
          <span style={{ textAlign: "right" }}>Actions</span>
        </div>

        {visible.length > 0 ? (
          visible.map((item) => {
            const isPendingStatus = item.status === "PENDING";
            const isApproved = item.status === "APPROVED";
            const isRejected = item.status === "REJECTED";

            return (
              <div key={item.id} className="admin-row" style={{ gridTemplateColumns: "1.8fr 1.6fr 1fr 1fr 1.6fr" }}>
                <div>
                  <strong style={{ color: "var(--ink)", fontWeight: 700 }}>
                    {item.author?.name || item.author?.rollNumber || "Student"}
                  </strong>
                  <small style={{ color: "var(--muted)", display: "block", fontSize: "10px" }}>
                    {[item.author?.rollNumber, item.author?.branch, item.author?.batch ? `Batch ${item.author.batch}` : null]
                      .filter(Boolean)
                      .join(" · ") || item.author?.email}
                  </small>
                </div>

                <div>
                  <strong style={{ color: "var(--ink)" }}>{item.companyName}</strong>
                  <small style={{ color: "var(--muted)", display: "block", fontSize: "10px" }}>{item.role}</small>
                </div>

                <div style={{ fontSize: "11px" }}>{item.interviewType}</div>

                <div>
                  {isPendingStatus && (
                    <span className="cell-status pending" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Clock3 size={11} /> Pending
                    </span>
                  )}
                  {isApproved && (
                    <span className="cell-status" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <CheckCircle2 size={11} /> Live
                    </span>
                  )}
                  {isRejected && (
                    <span
                      className="cell-status"
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "var(--badge-red-bg)", color: "var(--badge-red-text)" }}
                    >
                      <XCircle size={11} /> Rejected
                    </span>
                  )}
                </div>

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

                  {isPendingStatus && (
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
              </div>
            );
          })
        ) : (
          <div className="admin-empty">
            <MessageSquareText size={32} />
            <h2>No interview experiences found</h2>
            <p>{query ? "No submissions match your search filter." : "No submissions in this status yet."}</p>
          </div>
        )}
      </section>

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
