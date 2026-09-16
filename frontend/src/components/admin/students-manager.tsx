"use client";

import Link from "next/link";
import { AlertTriangle, Eye, GraduationCap, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type AdminStudentListItem = {
  id: string;
  name: string;
  email: string;
  rollNumber: string | null;
  branch: string | null;
  batch: number | null;
  cgpa: number | null;
  completion: number;
  applicationCount: number;
  missedStreak: number;
  missedCompanies: string[];
};

export function StudentsManager({ students }: { students: AdminStudentListItem[] }) {
  const [query, setQuery] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const flaggedCount = useMemo(() => students.filter((s) => s.missedStreak >= 3).length, [students]);

  const visible = useMemo(
    () =>
      students.filter((student) => {
        const matchesSearch = `${student.name} ${student.email} ${student.rollNumber ?? ""} ${student.branch ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesFlag = !onlyFlagged || student.missedStreak >= 3;
        return matchesSearch && matchesFlag;
      }),
    [students, query, onlyFlagged],
  );

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Live student records</span>
          <h1>Students</h1>
          <p>Profiles created through authenticated institute Google accounts.</p>
        </div>
      </section>

      {flaggedCount > 0 && (
        <div
          className="notice warning"
          style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}
        >
          <AlertTriangle size={18} />
          <div>
            <strong>
              {flaggedCount} student{flaggedCount === 1 ? "" : "s"} {flaggedCount === 1 ? "needs" : "need"} follow-up.
            </strong>{" "}
            They were eligible for 3 or more companies in a row but did not apply to any of them.
          </div>
        </div>
      )}

      <section className="admin-toolbar">
        <label>
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, roll number, or branch"
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={onlyFlagged} onChange={(event) => setOnlyFlagged(event.target.checked)} />
          Needs follow-up only ({flaggedCount})
        </label>
      </section>

      <section className="admin-table">
        <div className="admin-row admin-row-head" style={{ gridTemplateColumns: "1.6fr 1.6fr 0.8fr 1fr 1.4fr 0.8fr" }}>
          <span>Student</span>
          <span>Academic profile</span>
          <span>CGPA</span>
          <span>Applications</span>
          <span>Follow-up</span>
          <span>Actions</span>
        </div>
        {visible.map((student) => {
          const isFlagged = student.missedStreak >= 3;
          return (
            <div className="admin-row" key={student.id} style={{ gridTemplateColumns: "1.6fr 1.6fr 0.8fr 1fr 1.4fr 0.8fr" }}>
              <span className="company-admin-name">
                <i>
                  <GraduationCap />
                </i>
                <span>
                  <strong>{student.name}</strong>
                  <small>{student.email}</small>
                </span>
              </span>
              <span>
                {student.rollNumber ?? "Roll not added"}
                <br />
                <small>
                  {student.branch ?? "Branch not added"}
                  {student.batch ? ` · ${student.batch}` : ""} · {student.completion}% complete
                </small>
              </span>
              <span>{student.cgpa ?? "Not added"}</span>
              <span>{student.applicationCount}</span>
              <span>
                {isFlagged ? (
                  <span
                    title={`Eligible but did not apply to ${student.missedStreak} companies in a row: ${student.missedCompanies.join(", ")}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 8px",
                      borderRadius: "9999px",
                      fontSize: "10px",
                      fontWeight: 800,
                      background: "var(--badge-orange-bg)",
                      color: "var(--badge-orange-text)",
                      cursor: "help",
                    }}
                  >
                    <AlertTriangle size={11} /> Missed {student.missedStreak} in a row
                  </span>
                ) : (
                  <small style={{ color: "var(--muted)" }}>—</small>
                )}
              </span>
              <span className="row-actions">
                <Link className="admin-icon-link" href={`/admin/students/${student.id}`} title={`View ${student.name}`}>
                  <Eye />
                </Link>
              </span>
            </div>
          );
        })}
        {!visible.length ? (
          <div className="admin-empty">
            <GraduationCap />
            <h2>{students.length ? "No matching students" : "No students yet"}</h2>
            <p>
              {students.length
                ? "Change the search query or follow-up filter."
                : "Students appear after their first institute Google sign-in."}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
