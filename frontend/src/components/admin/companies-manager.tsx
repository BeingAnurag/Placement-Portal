"use client";

import { Building2, Edit3, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deleteCompany, saveCompany, type CompanyActionResult } from "@/app/admin/companies/actions";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";

export type AdminCompanyItem = {
  id: string;
  name: string;
  website: string | null;
  logoUrl: string | null;
  description: string | null;
  jobCount: number;
  activeJobCount: number;
  createdAt: string;
};

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function CompaniesManager({ companies }: { companies: AdminCompanyItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminCompanyItem | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CompanyActionResult>({});

  async function submit(formData: FormData) {
    setSaving(true);
    const nextResult = await saveCompany(formData);
    setResult(nextResult);
    setSaving(false);
    if (nextResult.success) {
      setEditing(undefined);
      router.refresh();
    }
  }

  async function remove(formData: FormData) {
    const nextResult = await deleteCompany(formData);
    setResult(nextResult);
    if (nextResult.success) router.refresh();
  }

  const columns = useMemo<DataTableColumn<AdminCompanyItem>[]>(
    () => [
      {
        id: "name",
        header: "Company",
        width: "minmax(240px, 2fr)",
        sortValue: (company) => company.name,
        hideable: false,
        cell: (company) => (
          <span className="company-admin-name">
            <i>
              <Building2 />
            </i>
            <span>
              <strong>{company.name}</strong>
              <small>{company.description || "No description"}</small>
            </span>
          </span>
        ),
      },
      {
        id: "website",
        header: "Website",
        width: "minmax(150px, 1fr)",
        sortValue: (company) => company.website,
        cell: (company) =>
          company.website ? (
            <a className="admin-external-link" href={company.website} target="_blank" rel="noreferrer">
              Open website <ExternalLink />
            </a>
          ) : (
            <span className="dt-muted">Not provided</span>
          ),
      },
      {
        id: "jobs",
        header: "Job profiles",
        width: "minmax(140px, 1fr)",
        sortValue: (company) => company.jobCount,
        cell: (company) => (
          <span className="dt-numeric">
            <strong>{company.jobCount}</strong> total · {company.activeJobCount} active
          </span>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        width: "minmax(120px, 1fr)",
        sortValue: (company) => new Date(company.createdAt),
        cell: (company) => dateFormat.format(new Date(company.createdAt)),
      },
      {
        id: "actions",
        header: "Actions",
        width: "110px",
        hideable: false,
        cell: (company) => (
          <span className="row-actions">
            <button
              title={`Edit ${company.name}`}
              aria-label={`Edit ${company.name}`}
              onClick={() => {
                setResult({});
                setEditing(company);
              }}
            >
              <Edit3 />
            </button>
            <form action={remove}>
              <input type="hidden" name="companyId" value={company.id} />
              <button
                title={company.jobCount ? "Remove job profiles before deleting" : `Delete ${company.name}`}
                aria-label={`Delete ${company.name}`}
                disabled={company.jobCount > 0}
              >
                <Trash2 />
              </button>
            </form>
          </span>
        ),
      },
    ],
    // `remove` is redefined per render but closes over nothing that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Management</span>
          <h1>Companies</h1>
          <p>Create recruiter profiles before publishing their job opportunities.</p>
        </div>
        <button
          onClick={() => {
            setResult({});
            setEditing(null);
          }}
        >
          <Plus />
          Add company
        </button>
      </section>

      {result.success ? <div className="admin-success">{result.success}</div> : null}
      {result.error ? <div className="admin-error">{result.error}</div> : null}

      <DataTable
        data={companies}
        columns={columns}
        getRowId={(company) => company.id}
        searchText={(company) => `${company.name} ${company.website ?? ""} ${company.description ?? ""}`}
        searchPlaceholder="Search companies..."
        columnStorageKey="companies"
        minWidth={820}
        emptyIcon={<Building2 />}
        emptyTitle={companies.length ? "No matching companies" : "No companies yet"}
        emptyDescription={
          companies.length
            ? "Try changing your search or filters."
            : "Use Add company to create the first real recruiter record."
        }
      />

      {editing !== undefined ? (
        <div className="modal-backdrop">
          <form className="modal" action={submit}>
            <header>
              <div>
                <span className="eyebrow">Company record</span>
                <h2>{editing ? "Edit company" : "Add company"}</h2>
              </div>
              <button type="button" onClick={() => setEditing(undefined)} aria-label="Close dialog">
                <X />
              </button>
            </header>
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <div className="form-grid">
              <label className="wide">
                Company name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={editing?.name ?? ""}
                  placeholder="Example Technologies"
                />
              </label>
              <label>
                Website
                <input
                  name="website"
                  type="url"
                  defaultValue={editing?.website ?? ""}
                  placeholder="https://example.com"
                />
              </label>
              <label>
                Logo URL
                <input
                  name="logoUrl"
                  type="url"
                  defaultValue={editing?.logoUrl ?? ""}
                  placeholder="https://example.com/logo.png"
                />
              </label>
              <label className="wide">
                Description
                <textarea
                  name="description"
                  rows={5}
                  maxLength={2000}
                  defaultValue={editing?.description ?? ""}
                  placeholder="Short recruiter profile and industry overview"
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setEditing(undefined)}>
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create company"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
