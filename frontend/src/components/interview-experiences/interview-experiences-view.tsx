"use client";

import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { submitInterviewExperienceAction } from "@/app/interview-experiences/actions";
import { CompanyPicker } from "@/components/common/company-picker";
import { COMPANY_OPTIONS } from "@/lib/company-options";
import { INTERVIEW_TYPE_OPTIONS } from "@/lib/interview-experience-schema";

export type InterviewExperienceItem = {
  id: string;
  companyName: string;
  role: string;
  batch: number;
  interviewType: string;
  dsaQuestions?: string | null;
  oopsQuestions?: string | null;
  dbmsQuestions?: string | null;
  osQuestions?: string | null;
  cnQuestions?: string | null;
  sqlQuestions?: string | null;
  systemDesignQuestions?: string | null;
  csFundamentalsQuestions?: string | null;
  resumeQuestions?: string | null;
  projectsDiscussed?: string | null;
  codingQuestions?: string | null;
  aptitudeQuestions?: string | null;
  hrQuestions?: string | null;
  behavioralQuestions?: string | null;
  resources?: string | null;
  unansweredQuestions?: string | null;
  tips?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  reviewNote?: string | null;
  createdAt: string;
};

const QUESTION_SECTIONS: { key: keyof InterviewExperienceItem; label: string; placeholder: string }[] = [
  { key: "dsaQuestions", label: "DSA questions asked", placeholder: "e.g. Reverse a linked list, find the LCA of a BST..." },
  { key: "codingQuestions", label: "Coding question(s) asked", placeholder: "Describe the full coding problem statement(s)..." },
  { key: "oopsQuestions", label: "OOPS questions", placeholder: "e.g. Explain polymorphism with an example..." },
  { key: "dbmsQuestions", label: "DBMS questions", placeholder: "e.g. Normalization, indexing, ACID properties..." },
  { key: "sqlQuestions", label: "SQL questions", placeholder: "Any SQL queries or concepts asked..." },
  { key: "osQuestions", label: "Operating System questions", placeholder: "e.g. Deadlocks, paging, scheduling algorithms..." },
  { key: "cnQuestions", label: "Computer Networks questions", placeholder: "e.g. TCP vs UDP, OSI layers..." },
  { key: "systemDesignQuestions", label: "System Design / LLD / HLD questions", placeholder: "e.g. Design a URL shortener..." },
  { key: "csFundamentalsQuestions", label: "CS Fundamentals / Miscellaneous", placeholder: "Any other CS fundamentals asked..." },
  { key: "resumeQuestions", label: "Resume-based questions", placeholder: "Questions asked specifically about your resume..." },
  { key: "projectsDiscussed", label: "Projects discussed", placeholder: "Which projects came up and what was asked..." },
  { key: "aptitudeQuestions", label: "Puzzle / Aptitude questions", placeholder: "Any puzzles or aptitude questions..." },
  { key: "hrQuestions", label: "HR questions", placeholder: "e.g. Why this company, salary expectations..." },
  { key: "behavioralQuestions", label: "Behavioral questions", placeholder: "e.g. Tell me about a time you faced conflict in a team..." },
  { key: "unansweredQuestions", label: "Questions you could not answer", placeholder: "Be honest — this helps others prepare better!" },
  { key: "resources", label: "Resources that helped", placeholder: "Books, courses, playlists, sheets..." },
  { key: "tips", label: "Tips for future candidates", placeholder: "Your advice for students appearing next..." },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING") {
    return (
      <span className="cell-status pending" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <Clock3 size={11} /> Pending review
      </span>
    );
  }
  if (status === "APPROVED") {
    return (
      <span className="cell-status" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <CheckCircle2 size={11} /> Live
      </span>
    );
  }
  return (
    <span
      className="cell-status"
      style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "var(--badge-red-bg)", color: "var(--badge-red-text)" }}
    >
      <XCircle size={11} /> Not approved
    </span>
  );
}

function ExperienceDetail({ item }: { item: InterviewExperienceItem }) {
  const filledSections = QUESTION_SECTIONS.filter((section) => item[section.key]);

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {filledSections.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: "12px" }}>No additional details were shared for this submission.</p>
      )}
      {filledSections.map((section) => (
        <div
          key={String(section.key)}
          style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px" }}
        >
          <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            {section.label}
          </span>
          <p style={{ margin: "6px 0 0", fontSize: "12px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
            {String(item[section.key])}
          </p>
        </div>
      ))}
    </div>
  );
}

export function InterviewExperiencesView({
  approvedExperiences,
  myExperiences,
  companies,
}: {
  approvedExperiences: InterviewExperienceItem[];
  myExperiences: InterviewExperienceItem[];
  companies: string[];
}) {
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [viewing, setViewing] = useState<InterviewExperienceItem | null>(null);
  const [modal, setModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => {
    return approvedExperiences.filter((item) => {
      const matchesCompany = !companyFilter || item.companyName === companyFilter;
      const matchesSearch =
        !query ||
        `${item.companyName} ${item.role} ${item.interviewType}`.toLowerCase().includes(query.toLowerCase());
      return matchesCompany && matchesSearch;
    });
  }, [approvedExperiences, query, companyFilter]);

  function handleSubmit(formData: FormData) {
    setFormError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const result = await submitInterviewExperienceAction(formData);
      if (!result?.error) {
        setModal(false);
        setActionSuccess(result.message ?? "Submitted successfully.");
      } else {
        setFormError(result.error);
      }
    });
  }

  function openModal() {
    setFormError(null);
    setModal(true);
  }

  return (
    <div className="module-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Community</span>
          <h1>Interview experiences</h1>
          <p>Real questions asked in real interviews, shared by your seniors and peers.</p>
        </div>
        <button onClick={openModal}>
          <Plus />
          Share your experience
        </button>
      </section>

      {actionSuccess && (
        <div className="save-message" style={{ marginBottom: "16px" }}>
          <CheckCircle2 size={16} />
          {actionSuccess}
        </div>
      )}

      <div className="tabs">
        {[
          ["browse", `Browse (${approvedExperiences.length})`],
          ["mine", `My submissions (${myExperiences.length})`],
        ].map(([id, label]) => (
          <button className={tab === id ? "active" : ""} onClick={() => setTab(id as "browse" | "mine")} key={id}>
            {label}
          </button>
        ))}
      </div>

      {tab === "browse" && (
        <section>
          <div className="admin-toolbar" style={{ marginBottom: "14px" }}>
            <label>
              <Search />
              <input
                type="search"
                placeholder="Search by company, role, or interview type..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} aria-label="Filter by company">
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {visible.length ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {visible.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setViewing(item)}
                  style={{
                    textAlign: "left",
                    background: "var(--card-bg, #fff)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    cursor: "pointer",
                    display: "grid",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <strong style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink)", fontSize: "13px" }}>
                      <Building2 size={14} /> {item.companyName}
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                      {new Date(item.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "11px", color: "var(--muted)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Briefcase size={12} /> {item.role}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={12} /> Batch {item.batch}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <MessageSquareText size={12} /> {item.interviewType}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty">
              <Sparkles />
              <h3>No interview experiences yet</h3>
              <p>Be the first to share what was asked in your interview.</p>
            </div>
          )}
        </section>
      )}

      {tab === "mine" && (
        <section>
          {myExperiences.length ? (
            <div className="simple-table" style={{ marginTop: "4px" }}>
              <div>
                <b>Company & role</b>
                <b>Interview type</b>
                <b>Status</b>
                <b>Submitted</b>
              </div>
              {myExperiences.map((item) => (
                <div
                  key={item.id}
                  style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr", cursor: "pointer" }}
                  onClick={() => setViewing(item)}
                >
                  <div>
                    <strong style={{ color: "var(--ink)", display: "block" }}>{item.companyName}</strong>
                    <small style={{ color: "var(--muted)", fontSize: "10px" }}>{item.role}</small>
                  </div>
                  <div>{item.interviewType}</div>
                  <div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div>
                    {new Date(item.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <MessageSquareText />
              <h3>No submissions yet</h3>
              <p>Share your interview experience to help fellow students prepare.</p>
            </div>
          )}
        </section>
      )}

      {/* Submission modal */}
      {modal && (
        <div className="modal-backdrop">
          <form className="modal" style={{ maxWidth: "720px", maxHeight: "88vh", overflowY: "auto" }} action={handleSubmit}>
            <header>
              <div>
                <span className="eyebrow">New submission</span>
                <h2>Share your interview experience</h2>
              </div>
              <button type="button" onClick={() => setModal(false)} aria-label="Close modal">
                <X />
              </button>
            </header>

            <p style={{ fontSize: "11px", color: "var(--muted)", margin: "8px 0 14px" }}>
              Your submission is reviewed by the Placement Cell before it becomes visible to other students. Fill in
              whichever sections apply — you don&apos;t need to answer everything.
            </p>

            <div className="form-grid">
              {formError && (
                <div
                  style={{
                    color: "var(--badge-red-text)",
                    background: "var(--badge-red-bg)",
                    border: "1px solid var(--badge-red-text)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    gridColumn: "1 / -1",
                  }}
                >
                  {formError}
                </div>
              )}

              <label>
                Company name
                <CompanyPicker name="companyName" options={COMPANY_OPTIONS} />
              </label>
              <label>
                Role
                <input name="role" required minLength={2} placeholder="e.g. SDE-1" />
              </label>
              <label>
                Batch
                <input name="batch" required type="number" min={2000} max={2100} placeholder="e.g. 2026" />
              </label>
              <label>
                Interview type
                <input name="interviewType" required list="interview-type-options" placeholder="e.g. On-Campus" />
                <datalist id="interview-type-options">
                  {INTERVIEW_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </label>

              {QUESTION_SECTIONS.map((section) => (
                <label key={String(section.key)} className="wide">
                  {section.label} (optional)
                  <textarea name={String(section.key)} rows={2} placeholder={section.placeholder} />
                </label>
              ))}
            </div>

            <footer>
              <button type="button" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isPending}>
                <Sparkles size={14} />
                {isPending ? "Submitting..." : "Submit for review"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Detail modal */}
      {viewing && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "680px", maxHeight: "88vh", overflowY: "auto" }}>
            <header>
              <div>
                <span className="eyebrow">{viewing.interviewType}</span>
                <h2>
                  {viewing.companyName} · {viewing.role}
                </h2>
              </div>
              <button type="button" onClick={() => setViewing(null)} aria-label="Close details">
                <X />
              </button>
            </header>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "10px 0 16px", fontSize: "11px", color: "var(--muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Calendar size={12} /> Batch {viewing.batch}
              </span>
              {viewing.status !== "APPROVED" && <StatusBadge status={viewing.status} />}
            </div>

            {viewing.status === "REJECTED" && viewing.reviewNote && (
              <div
                style={{
                  background: "var(--badge-red-bg)",
                  border: "1px solid var(--badge-red-text)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginBottom: "14px",
                  fontSize: "12px",
                }}
              >
                <strong style={{ color: "var(--badge-red-text)" }}>Reviewer note: </strong>
                {viewing.reviewNote}
              </div>
            )}

            <ExperienceDetail item={viewing} />

            <footer>
              <button type="button" onClick={() => setViewing(null)}>
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
