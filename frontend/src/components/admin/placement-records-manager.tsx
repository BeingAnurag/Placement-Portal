"use client";

import { Award, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  deleteOfferAction,
  saveOfferAction,
  type OfferActionResult,
} from "@/app/admin/placement-records/actions";
import {
  formatRupees,
  formatStipend,
  isCtcType,
  OFFER_STATUS_LABELS,
  OFFER_TYPE_LABELS,
  type OfferStatus,
  type OfferType,
} from "@/lib/offer-schema";

export type StudentOption = {
  id: string;
  name: string | null;
  email: string | null;
  rollNumber: string | null;
  branch: string | null;
  degree: string | null;
  batch: number | null;
};

export type CompanyOption = { id: string; name: string };

export type JobOption = {
  id: string;
  title: string;
  companyId: string;
  companyName: string | null;
  batch: number;
};

export type OfferRecord = {
  id: string;
  userId: string;
  companyId: string;
  jobProfileId: string | null;
  jobTitle: string | null;
  type: OfferType;
  status: OfferStatus;
  batch: number;
  ctc: number | null;
  stipend: number | null;
  location: string | null;
  offeredAt: string | null;
  joiningDate: string | null;
  remarks: string | null;
  student: {
    id: string;
    name: string | null;
    email: string | null;
    rollNumber: string | null;
    branch: string | null;
    degree: string | null;
  } | null;
  company: { id: string; name: string } | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

/** `<input type="date">` wants a plain yyyy-mm-dd in the viewer's own day. */
function dateInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function studentLabel(student: StudentOption) {
  const name = student.name ?? student.email ?? "Unnamed student";
  const roll = student.rollNumber ? ` (${student.rollNumber})` : "";
  const batch = student.batch ? ` · ${student.batch}` : "";
  return `${name}${roll}${batch}`;
}

export function PlacementRecordsManager({
  offers,
  students,
  companies,
  jobs,
  backendError,
}: {
  offers: OfferRecord[];
  students: StudentOption[];
  companies: CompanyOption[];
  jobs: JobOption[];
  backendError: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editing, setEditing] = useState<OfferRecord | null | undefined>(undefined);
  const [formType, setFormType] = useState<OfferType>("FTE");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<OfferActionResult>({});

  const seasons = useMemo(
    () => [...new Set(offers.map((offer) => offer.batch))].sort((a, b) => b - a),
    [offers],
  );

  const visible = useMemo(
    () =>
      offers.filter((offer) => {
        const haystack = `${offer.student?.name ?? ""} ${offer.student?.rollNumber ?? ""} ${
          offer.student?.email ?? ""
        } ${offer.company?.name ?? ""} ${offer.jobTitle ?? ""}`.toLowerCase();
        return (
          haystack.includes(query.trim().toLowerCase()) &&
          (seasonFilter === "ALL" || String(offer.batch) === seasonFilter) &&
          (typeFilter === "ALL" || offer.type === typeFilter) &&
          (statusFilter === "ALL" || offer.status === statusFilter)
        );
      }),
    [offers, query, seasonFilter, typeFilter, statusFilter],
  );

  function openForm(offer: OfferRecord | null) {
    setResult({});
    setFormType(offer?.type ?? "FTE");
    setEditing(offer);
  }

  async function submit(formData: FormData) {
    setSaving(true);
    const next = await saveOfferAction(formData);
    setResult(next);
    setSaving(false);
    if (next.success) {
      setEditing(undefined);
      router.refresh();
    }
  }

  async function remove(formData: FormData) {
    const next = await deleteOfferAction(formData);
    setResult(next);
    if (next.success) router.refresh();
  }

  const createDisabledReason = backendError
    ? "The API service is unreachable."
    : !students.length
      ? "Register a student before recording an offer."
      : !companies.length
        ? "Add a company before recording an offer."
        : null;

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Placement records</span>
          <h1>Offers</h1>
          <p>Every placement, pre-placement, and internship offer. The dashboard is built from these rows.</p>
        </div>
        <button
          disabled={Boolean(createDisabledReason)}
          title={createDisabledReason ?? "Add placement record"}
          onClick={() => openForm(null)}
        >
          <Plus />
          Add record
        </button>
      </section>

      {backendError ? <div className="admin-error">{backendError}</div> : null}
      {result.success ? <div className="admin-success">{result.success}</div> : null}
      {result.error ? <div className="admin-error">{result.error}</div> : null}

      <section className="admin-toolbar">
        <label>
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search student, roll number, or company"
          />
        </label>
        <select
          aria-label="Filter by season"
          value={seasonFilter}
          onChange={(event) => setSeasonFilter(event.target.value)}
        >
          <option value="ALL">All seasons</option>
          {seasons.map((season) => (
            <option key={season} value={String(season)}>
              {season}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by offer type"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="ALL">All types</option>
          {Object.entries(OFFER_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by offer status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="ALL">All statuses</option>
          {Object.entries(OFFER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </section>

      <section className="admin-table">
        <div className="admin-row admin-row-head">
          <span>Student</span>
          <span>Company &amp; role</span>
          <span>Package</span>
          <span>Season</span>
          <span>Actions</span>
        </div>
        {visible.map((offer) => (
          <div className="admin-row" key={offer.id}>
            <span className="company-admin-name">
              <i>
                <Award />
              </i>
              <span>
                <strong>{offer.student?.name ?? "Student"}</strong>
                <small>
                  {[offer.student?.rollNumber, offer.student?.branch, offer.student?.degree]
                    .filter(Boolean)
                    .join(" · ") || "Profile incomplete"}
                </small>
              </span>
            </span>
            <span>
              <strong>{offer.company?.name ?? "—"}</strong>
              <br />
              <small>{offer.jobTitle ?? offer.location ?? "Recorded off-portal"}</small>
            </span>
            <span>
              <strong>
                {isCtcType(offer.type) ? formatRupees(offer.ctc) : formatStipend(offer.stipend)}
              </strong>
              <br />
              <small>{OFFER_TYPE_LABELS[offer.type]}</small>
            </span>
            <span>
              <b className={`cell-status ${offer.status.toLowerCase()}`}>
                {OFFER_STATUS_LABELS[offer.status]}
              </b>
              <br />
              <small>
                {offer.batch} · offered {formatDate(offer.offeredAt)}
              </small>
            </span>
            <span className="row-actions">
              <button title={`Edit the offer for ${offer.student?.name ?? "this student"}`} onClick={() => openForm(offer)}>
                <Edit3 />
              </button>
              <form action={remove}>
                <input type="hidden" name="offerId" value={offer.id} />
                <button title="Delete this placement record">
                  <Trash2 />
                </button>
              </form>
            </span>
          </div>
        ))}
        {!visible.length ? (
          <div className="admin-empty">
            <Award />
            <h2>{offers.length ? "No matching records" : "No placement records yet"}</h2>
            <p>
              {offers.length
                ? "Change the search or the filters above."
                : "Add the season's first offer; the dashboard fills in from here."}
            </p>
          </div>
        ) : null}
      </section>

      {editing !== undefined ? (
        <div className="modal-backdrop">
          <form className="modal job-profile-modal" action={submit}>
            <header>
              <div>
                <span className="eyebrow">Placement record</span>
                <h2>{editing ? "Edit offer" : "Add offer"}</h2>
              </div>
              <button type="button" onClick={() => setEditing(undefined)} aria-label="Close dialog">
                <X />
              </button>
            </header>
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <div className="form-grid">
              <label className="wide">
                Student
                <select name="userId" required defaultValue={editing?.userId ?? ""}>
                  <option value="" disabled>
                    Select a student
                  </option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {studentLabel(student)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Company
                <select name="companyId" required defaultValue={editing?.companyId ?? ""}>
                  <option value="" disabled>
                    Select a company
                  </option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Drive (optional)
                <select name="jobProfileId" defaultValue={editing?.jobProfileId ?? ""}>
                  <option value="">Not from a portal drive</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.companyName ? `${job.companyName} · ` : ""}
                      {job.title} ({job.batch})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Offer type
                <select
                  name="type"
                  value={formType}
                  onChange={(event) => setFormType(event.target.value as OfferType)}
                >
                  {Object.entries(OFFER_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue={editing?.status ?? "OFFERED"}>
                  {Object.entries(OFFER_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Season (graduating batch)
                <input
                  name="batch"
                  type="number"
                  required
                  min={2000}
                  max={2100}
                  defaultValue={editing?.batch ?? new Date().getFullYear() + 1}
                />
              </label>
              {isCtcType(formType) ? (
                <label>
                  Annual CTC (₹)
                  <input
                    name="ctc"
                    type="number"
                    min={0}
                    step="any"
                    required
                    defaultValue={editing?.ctc ?? ""}
                    placeholder="1800000"
                  />
                </label>
              ) : (
                <label>
                  Monthly stipend (₹)
                  <input
                    name="stipend"
                    type="number"
                    min={0}
                    step="any"
                    required
                    defaultValue={editing?.stipend ?? ""}
                    placeholder="75000"
                  />
                </label>
              )}
              <label>
                Location
                <input
                  name="location"
                  maxLength={200}
                  defaultValue={editing?.location ?? ""}
                  placeholder="Bengaluru"
                />
              </label>
              <label>
                Offer date
                <input name="offeredAt" type="date" defaultValue={dateInputValue(editing?.offeredAt ?? null)} />
              </label>
              <label>
                Joining date
                <input
                  name="joiningDate"
                  type="date"
                  defaultValue={dateInputValue(editing?.joiningDate ?? null)}
                />
              </label>
              <label className="wide">
                Remarks
                <textarea
                  name="remarks"
                  rows={3}
                  maxLength={2000}
                  defaultValue={editing?.remarks ?? ""}
                  placeholder="Anything the office needs on file about this offer."
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setEditing(undefined)}>
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add record"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
