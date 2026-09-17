"use client";

import { Award, Edit3, Plus, Trash2, X } from "lucide-react";
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
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";

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
  const [editing, setEditing] = useState<OfferRecord | null | undefined>(undefined);
  const [formType, setFormType] = useState<OfferType>("FTE");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<OfferActionResult>({});

  const seasons = useMemo(
    () => [...new Set(offers.map((offer) => offer.batch))].sort((a, b) => b - a),
    [offers],
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

  const columns = useMemo<DataTableColumn<OfferRecord>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        width: "minmax(220px, 1.8fr)",
        hideable: false,
        sortValue: (offer) => offer.student?.name ?? offer.student?.email,
        cell: (offer) => (
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
        ),
      },
      {
        id: "company",
        header: "Company & role",
        width: "minmax(180px, 1.4fr)",
        sortValue: (offer) => offer.company?.name,
        cell: (offer) => (
          <span className="dt-primary">
            <strong>{offer.company?.name ?? "—"}</strong>
            <small>{offer.jobTitle ?? offer.location ?? "Recorded off-portal"}</small>
          </span>
        ),
      },
      {
        id: "package",
        header: "Package",
        width: "minmax(140px, 1fr)",
        // Sorted on the amount, not on the formatted rupee string, and a CTC
        // is never compared against a monthly stipend.
        sortValue: (offer) => (isCtcType(offer.type) ? offer.ctc : offer.stipend),
        cell: (offer) => (
          <span className="dt-primary">
            <strong className="dt-numeric">
              {isCtcType(offer.type) ? formatRupees(offer.ctc) : formatStipend(offer.stipend)}
            </strong>
            <small>{OFFER_TYPE_LABELS[offer.type]}</small>
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "minmax(150px, 1fr)",
        sortValue: (offer) => offer.status,
        cell: (offer) => (
          <span className="dt-primary">
            <b className={`cell-status ${offer.status.toLowerCase()}`}>
              {OFFER_STATUS_LABELS[offer.status]}
            </b>
            <small>offered {formatDate(offer.offeredAt)}</small>
          </span>
        ),
      },
      {
        id: "batch",
        header: "Season",
        width: "100px",
        sortValue: (offer) => offer.batch,
        cell: (offer) => <span className="dt-numeric">{offer.batch}</span>,
      },
      {
        id: "joiningDate",
        header: "Joining",
        width: "120px",
        defaultHidden: true,
        sortValue: (offer) => (offer.joiningDate ? new Date(offer.joiningDate) : null),
        cell: (offer) => formatDate(offer.joiningDate),
      },
      {
        id: "location",
        header: "Location",
        width: "140px",
        defaultHidden: true,
        sortValue: (offer) => offer.location,
        cell: (offer) => offer.location ?? <span className="dt-muted">Not recorded</span>,
      },
      {
        id: "actions",
        header: "Actions",
        width: "110px",
        hideable: false,
        cell: (offer) => (
          <span className="row-actions">
            <button
              title={`Edit the offer for ${offer.student?.name ?? "this student"}`}
              aria-label={`Edit the offer for ${offer.student?.name ?? "this student"}`}
              onClick={() => openForm(offer)}
            >
              <Edit3 />
            </button>
            <form action={remove}>
              <input type="hidden" name="offerId" value={offer.id} />
              <button title="Delete this placement record" aria-label="Delete this placement record">
                <Trash2 />
              </button>
            </form>
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const filters = useMemo<DataTableFilter<OfferRecord>[]>(
    () => [
      {
        id: "season",
        label: "Season",
        options: seasons.map((season) => ({ value: String(season), label: String(season) })),
        value: (offer) => String(offer.batch),
      },
      {
        id: "type",
        label: "Type",
        options: Object.entries(OFFER_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        value: (offer) => offer.type,
      },
      {
        id: "status",
        label: "Status",
        options: Object.entries(OFFER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
        value: (offer) => offer.status,
      },
    ],
    [seasons],
  );

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

      <DataTable
        data={offers}
        columns={columns}
        filters={filters}
        getRowId={(offer) => offer.id}
        searchText={(offer) =>
          `${offer.student?.name ?? ""} ${offer.student?.rollNumber ?? ""} ${
            offer.student?.email ?? ""
          } ${offer.company?.name ?? ""} ${offer.jobTitle ?? ""}`
        }
        searchPlaceholder="Search student, roll number, or company"
        columnStorageKey="placement-records"
        minWidth={1080}
        initialSort={{ columnId: "batch", direction: "desc" }}
        emptyIcon={<Award />}
        emptyTitle={offers.length ? "No matching records" : "No placement records yet"}
        emptyDescription={
          offers.length
            ? "Try changing your search or filters."
            : "Add the season's first offer; the dashboard fills in from here."
        }
      />

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
