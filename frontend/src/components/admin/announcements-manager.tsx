"use client";

import {
  BellRing,
  Building2,
  Calendar,
  Edit3,
  Eye,
  FileClock,
  Megaphone,
  Paperclip,
  Plus,
  Send,
  Trash2,
  Undo2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  deleteAnnouncementAction,
  saveAnnouncementAction,
  setAnnouncementStatusAction,
  type AnnouncementActionResult,
} from "@/app/admin/announcements/actions";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import type { AnnouncementStatus } from "@/lib/announcement-schema";

export type AdminAnnouncementItem = {
  id: string;
  title: string;
  content: string;
  category: "COMPANY_EVENT" | "GENERAL";
  /** DRAFT is placement-cell only; PUBLISHED is on every student's feed. */
  status: AnnouncementStatus;
  publishedAt: string | null;
  tags: string[];
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  createdAt: string;
  createdByName: string | null;
  createdByEmail: string | null;
  attachments: AnnouncementAttachment[];
};

export type AnnouncementAttachment = {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
};

export type CompanyOption = {
  id: string;
  name: string;
};

const dateOnly = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const PRESET_TAGS = [
  "Shortlist",
  "Interview",
  "Assessment",
  "Drive",
  "PPT",
  "Results",
  "Registration",
  "Policy",
  "Urgent",
];

/**
 * Announcements are written on their own pages — company event and general —
 * and managed here: what is live, what is still a draft, and moving one to
 * the other.
 */
export function AnnouncementsManager({
  announcements,
  companies,
  canPersist,
}: {
  announcements: AdminAnnouncementItem[];
  companies: CompanyOption[];
  canPersist: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminAnnouncementItem | null | undefined>(undefined);
  const [previewing, setPreviewing] = useState<AdminAnnouncementItem | null>(null);
  const [deleting, setDeleting] = useState<AdminAnnouncementItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnnouncementActionResult>({});

  // Modal form internal state
  const [formCategory, setFormCategory] = useState<"COMPANY_EVENT" | "GENERAL">("GENERAL");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  // Which footer button was pressed. A ref, not state, because the value has
  // to be readable inside the submit handler of the same click.
  const submitStatus = useRef<AnnouncementStatus>("PUBLISHED");

  const metrics = useMemo(() => {
    const companyEvents = announcements.filter((a) => a.category === "COMPANY_EVENT").length;
    const general = announcements.filter((a) => a.category === "GENERAL").length;
    const active = announcements.filter((a) => a.status === "PUBLISHED").length;
    const drafts = announcements.filter((a) => a.status === "DRAFT").length;
    return { companyEvents, general, active, drafts };
  }, [announcements]);

  async function changeStatus(formData: FormData) {
    setSaving(true);
    const nextResult = await setAnnouncementStatusAction(formData);
    setResult(nextResult);
    setSaving(false);
    if (nextResult.success) router.refresh();
  }

  function openEditModal(item: AdminAnnouncementItem) {
    setResult({});
    setFormCategory(item.category);
    setFormTags([...item.tags]);
    setCustomTagInput("");
    // Editing keeps the announcement where it is: saving a live announcement
    // must not quietly withdraw it, and saving a draft must not publish it.
    submitStatus.current = item.status;
    setEditing(item);
  }

  function togglePresetTag(tag: string) {
    setFormTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addCustomTag() {
    const trimmed = customTagInput.trim();
    if (trimmed && !formTags.includes(trimmed)) {
      setFormTags((prev) => [...prev, trimmed]);
      setCustomTagInput("");
    }
  }

  function removeTag(tagToRemove: string) {
    setFormTags((prev) => prev.filter((t) => t !== tagToRemove));
  }

  async function submitForm(formData: FormData) {
    setSaving(true);
    formData.set("tags", JSON.stringify(formTags));
    formData.set("category", formCategory);
    formData.set("status", submitStatus.current);
    const nextResult = await saveAnnouncementAction(formData);
    setResult(nextResult);
    setSaving(false);
    if (nextResult.success) {
      setEditing(undefined);
      router.refresh();
    }
  }

  async function handleRemove(formData: FormData) {
    setSaving(true);
    const nextResult = await deleteAnnouncementAction(formData);
    setResult(nextResult);
    setSaving(false);
    setDeleting(null);
    if (nextResult.success) {
      router.refresh();
    }
  }

  const columns = useMemo<DataTableColumn<AdminAnnouncementItem>[]>(
    () => [
      {
        id: "title",
        header: "Title & Overview",
        width: "minmax(260px, 1.6fr)",
        hideable: false,
        sortValue: (item) => item.title,
        cell: (item) => (
          <span style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background:
                  item.category === "COMPANY_EVENT"
                    ? "var(--badge-blue-bg)"
                    : "var(--badge-purple-bg)",
                color:
                  item.category === "COMPANY_EVENT"
                    ? "var(--blue)"
                    : "var(--badge-purple-text)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {item.category === "COMPANY_EVENT" ? <Building2 size={16} /> : <Megaphone size={16} />}
            </span>
            <span style={{ minWidth: 0 }}>
              <strong
                style={{
                  color: "var(--ink)",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={item.title}
              >
                {item.title}
              </strong>
              <span
                style={{
                  color: "var(--muted)",
                  fontSize: 11,
                  display: "block",
                  margin: "2px 0 0",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 320,
                }}
              >
                {item.content}
              </span>
            </span>
          </span>
        ),
      },
      {
        id: "status",
        header: "Status & Target",
        width: "minmax(140px, 1fr)",
        sortValue: (item) => item.status,
        cell: (item) => (
          <>
            <span
              className={`cell-status ${item.status === "DRAFT" ? "draft" : ""}`}
              style={{ fontSize: 9.5, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}
            >
              {item.status === "DRAFT" ? "Draft" : "Active"}
            </span>
            <small style={{ display: "block", color: "var(--muted)", marginTop: 4 }}>
              {item.category === "COMPANY_EVENT" ? "Company event" : "General update"}
            </small>
            {item.companyName ? (
              <small
                style={{
                  display: "block",
                  color: "var(--ink)",
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                {item.companyName}
              </small>
            ) : null}
          </>
        ),
      },
      {
        id: "tags",
        header: "Tags",
        width: "minmax(140px, 1fr)",
        sortValue: (item) => item.tags.length,
        cell: (item) => (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {item.tags.length > 0 ? (
              item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 9,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                    color: "var(--ink)",
                    fontWeight: 600,
                  }}
                >
                  {tag}
                </span>
              ))
            ) : (
              <small style={{ color: "var(--muted)" }}>No tags</small>
            )}
            {item.tags.length > 3 ? (
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 5px",
                  borderRadius: 4,
                  background: "var(--surface-highlight)",
                  color: "var(--muted)",
                  fontWeight: 700,
                }}
              >
                +{item.tags.length - 3}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "published",
        header: "Author & Published",
        width: "minmax(150px, 1fr)",
        // Sorts by the date the cell shows, which is the publication date once
        // an announcement is live and the writing date while it is a draft.
        sortValue: (item) =>
          new Date(item.status === "PUBLISHED" && item.publishedAt ? item.publishedAt : item.createdAt),
        cell: (item) => (
          <>
            <span style={{ fontWeight: 600, color: "var(--ink)", display: "block" }}>
              {item.createdByName || item.createdByEmail || "Placement Cell"}
            </span>
            <small style={{ color: "var(--muted)", fontSize: 10 }}>
              {item.status === "PUBLISHED" && item.publishedAt
                ? `Published ${dateOnly.format(new Date(item.publishedAt))}`
                : `Written ${dateOnly.format(new Date(item.createdAt))}`}
            </small>
          </>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        width: "132px",
        align: "right",
        hideable: false,
        cell: (item) => (
          <span className="row-actions" style={{ justifyContent: "flex-end" }}>
            <form action={changeStatus}>
              <input type="hidden" name="announcementId" value={item.id} />
              <input
                type="hidden"
                name="status"
                value={item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"}
              />
              <button
                title={
                  item.status === "PUBLISHED"
                    ? "Withdraw to drafts — students stop seeing it"
                    : "Publish — students see it immediately"
                }
                aria-label={
                  item.status === "PUBLISHED"
                    ? `Withdraw ${item.title} to drafts`
                    : `Publish ${item.title}`
                }
                disabled={!canPersist || saving}
                type="submit"
              >
                {item.status === "PUBLISHED" ? <Undo2 /> : <Send />}
              </button>
            </form>
            <button
              title="Preview announcement"
              aria-label={`Preview ${item.title}`}
              onClick={() => setPreviewing(item)}
              type="button"
            >
              <Eye />
            </button>
            <button
              title="Edit announcement"
              aria-label={`Edit ${item.title}`}
              onClick={() => openEditModal(item)}
              type="button"
            >
              <Edit3 />
            </button>
            <button
              title="Delete announcement"
              aria-label={`Delete ${item.title}`}
              onClick={() => setDeleting(item)}
              type="button"
            >
              <Trash2 />
            </button>
          </span>
        ),
      },
    ],
    // `changeStatus` and `openEditModal` are redefined per render but close
    // over nothing beyond the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canPersist, saving],
  );

  const filters = useMemo<DataTableFilter<AdminAnnouncementItem>[]>(
    () => [
      {
        id: "status",
        label: "Status",
        options: [
          { value: "PUBLISHED", label: "Active" },
          { value: "DRAFT", label: "Drafts" },
        ],
        value: (item) => item.status,
      },
      {
        id: "category",
        label: "Category",
        options: [
          { value: "COMPANY_EVENT", label: "Company events" },
          { value: "GENERAL", label: "General notices" },
        ],
        value: (item) => item.category,
      },
      ...(companies.length
        ? [
            {
              id: "company",
              label: "Company",
              options: companies.map((comp) => ({ value: comp.id, label: comp.name })),
              value: (item: AdminAnnouncementItem) => item.companyId,
            },
          ]
        : []),
    ],
    [companies],
  );

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Communications & Drives</span>
          <h1>Active &amp; drafts</h1>
          <p>
            Everything published or held as a draft, and the control to move one to the other.
          </p>
        </div>
        <Link href="/admin/announcements/company-event">
          <Plus />
          Write an announcement
        </Link>
      </section>

      <nav className="admin-tabs" aria-label="Announcement pages">
        <Link href="/admin/announcements/company-event">
          <Building2 />
          Company event announcement
          <b>{metrics.companyEvents}</b>
        </Link>
        <Link href="/admin/announcements/general">
          <Megaphone />
          General announcement
          <b>{metrics.general}</b>
        </Link>
        <span className="active" aria-current="page">
          <FileClock />
          Active &amp; drafts
          <b>{announcements.length}</b>
        </span>
      </nav>

      {result.success ? <div className="admin-success">{result.success}</div> : null}
      {result.error ? <div className="admin-error">{result.error}</div> : null}

      {/* Metrics Banner */}
      <section className="admin-metrics">
        <article>
          <div className="metric-icon blue">
            <Building2 />
          </div>
          <div>
            <small>Company Drives</small>
            <strong>{metrics.companyEvents}</strong>
            <b>Hiring updates &amp; shortlists</b>
          </div>
        </article>

        <article>
          <div className="metric-icon violet">
            <Megaphone />
          </div>
          <div>
            <small>General Notices</small>
            <strong>{metrics.general}</strong>
            <b style={{ color: "var(--badge-purple-text)" }}>Policy &amp; campus updates</b>
          </div>
        </article>

        <article>
          <div className="metric-icon green">
            <BellRing />
          </div>
          <div>
            <small>Active</small>
            <strong>{metrics.active}</strong>
            <b>Visible to students now</b>
          </div>
        </article>

        <article>
          <div className="metric-icon orange">
            <FileClock />
          </div>
          <div>
            <small>Drafts</small>
            <strong>{metrics.drafts}</strong>
            <b style={{ color: "var(--orange)" }}>Not visible to students</b>
          </div>
        </article>
      </section>

      <DataTable
        data={announcements}
        columns={columns}
        getRowId={(item) => item.id}
        searchText={(item) =>
          `${item.title} ${item.content} ${item.companyName ?? ""} ${item.tags.join(" ")} ${item.createdByName ?? ""}`
        }
        searchPlaceholder="Search by title, content, company, or tags…"
        filters={filters}
        columnStorageKey="announcements"
        minWidth={900}
        emptyIcon={<Megaphone />}
        emptyTitle={
          announcements.length
            ? "No announcements in this view"
            : "No announcements written yet"
        }
        emptyDescription={
          announcements.length
            ? "Clear the search or the status and category filters."
            : "Write a company event or general announcement; every one appears here, live or draft."
        }
      />

      {/* CREATE / EDIT MODAL */}
      {editing !== undefined ? (
        <div className="modal-backdrop">
          <form
            key={editing?.id ?? "create"}
            className="modal"
            action={submitForm}
            style={{ width: "min(720px, 100%)" }}
          >
            <header>
              <div>
                <span className="eyebrow">Announcement Record</span>
                <h2>{editing ? "Edit announcement" : "Create announcement"}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(undefined)}
                aria-label="Close dialog"
              >
                <X />
              </button>
            </header>

            <input type="hidden" name="id" value={editing?.id ?? ""} />

            <div className="form-grid">
              {/* Title */}
              <label className="wide">
                Announcement Title *
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={200}
                  defaultValue={editing?.title ?? ""}
                  placeholder="e.g., Google Technical Assessment Shortlist & Schedule"
                />
              </label>

              {/* Category Segmented Selector */}
              <div className="wide">
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--ink)",
                    marginBottom: 6,
                  }}
                >
                  Category *
                </span>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setFormCategory("GENERAL")}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid",
                      borderColor:
                        formCategory === "GENERAL" ? "var(--blue)" : "var(--border)",
                      background:
                        formCategory === "GENERAL"
                          ? "var(--surface-highlight)"
                          : "var(--surface-alt)",
                      color: formCategory === "GENERAL" ? "var(--ink)" : "var(--muted)",
                      fontWeight: formCategory === "GENERAL" ? 700 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <Megaphone size={16} />
                    General Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCategory("COMPANY_EVENT")}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid",
                      borderColor:
                        formCategory === "COMPANY_EVENT" ? "var(--blue)" : "var(--border)",
                      background:
                        formCategory === "COMPANY_EVENT"
                          ? "var(--surface-highlight)"
                          : "var(--surface-alt)",
                      color:
                        formCategory === "COMPANY_EVENT" ? "var(--ink)" : "var(--muted)",
                      fontWeight: formCategory === "COMPANY_EVENT" ? 700 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <Building2 size={16} />
                    Company Drive / Event
                  </button>
                </div>
              </div>

              {/* Associated Company (when category is Company Event) */}
              {formCategory === "COMPANY_EVENT" ? (
                <label className="wide">
                  Associated Company
                  <select
                    name="companyId"
                    defaultValue={editing?.companyId ?? ""}
                  >
                    <option value="">-- Select Recruiting Company (Optional) --</option>
                    {companies.map((comp) => (
                      <option value={comp.id} key={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {/* Tags Selector & Custom Tag Input */}
              <div className="wide">
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--ink)",
                    marginBottom: 6,
                  }}
                >
                  Tags & Badges
                </span>

                {/* Preset Suggestions */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {PRESET_TAGS.map((tag) => {
                    const isSelected = formTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => togglePresetTag(tag)}
                        style={{
                          fontSize: 10,
                          fontWeight: isSelected ? 700 : 500,
                          padding: "4px 9px",
                          borderRadius: 9999,
                          border: "1px solid",
                          borderColor: isSelected ? "var(--blue)" : "var(--border)",
                          background: isSelected ? "var(--badge-blue-bg)" : "var(--card-bg)",
                          color: isSelected ? "var(--blue)" : "var(--muted)",
                          cursor: "pointer",
                        }}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {tag}
                      </button>
                    );
                  })}
                </div>

                {/* Active Selected Tags Display */}
                {formTags.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      padding: "8px 10px",
                      background: "var(--surface-alt)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      marginBottom: 8,
                    }}
                  >
                    {formTags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "var(--card-bg)",
                          border: "1px solid var(--border)",
                          color: "var(--ink)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          style={{
                            border: 0,
                            background: "transparent",
                            cursor: "pointer",
                            color: "var(--muted)",
                            padding: 0,
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Custom tag adder */}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomTag();
                      }
                    }}
                    placeholder="Add custom tag (press Enter or Add)..."
                    style={{ fontSize: 11 }}
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    style={{
                      padding: "0 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--surface-alt)",
                      color: "var(--ink)",
                      cursor: "pointer",
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Content / Body */}
              <label className="wide">
                Announcement Content *
                <textarea
                  name="content"
                  required
                  rows={8}
                  minLength={2}
                  maxLength={10000}
                  defaultValue={editing?.content ?? ""}
                  placeholder="Enter the full announcement details, test links, shortlist instructions, eligibility criteria, etc."
                />
              </label>
            </div>

            <footer>
              <button type="button" onClick={() => setEditing(undefined)}>
                Cancel
              </button>
              {/* Two submit buttons rather than a status dropdown: the choice
                  is the act, and the label says who will see the result. */}
              <button
                type="submit"
                disabled={saving}
                onClick={() => {
                  submitStatus.current = "DRAFT";
                }}
              >
                {saving ? "Saving…" : "Save as draft"}
              </button>
              <button
                type="submit"
                disabled={saving}
                onClick={() => {
                  submitStatus.current = "PUBLISHED";
                }}
              >
                {saving
                  ? "Publishing…"
                  : editing?.status === "PUBLISHED"
                    ? "Save & keep live"
                    : "Publish to students"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {/* DETAIL PREVIEW MODAL */}
      {previewing ? (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: "min(680px, 100%)" }}>
            <header>
              <div>
                <span className="eyebrow">
                  {previewing.category === "COMPANY_EVENT"
                    ? "Company Drive Announcement"
                    : "General Notice"}
                </span>
                <h2>{previewing.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewing(null)}
                aria-label="Close dialog"
              >
                <X />
              </button>
            </header>

            <div style={{ padding: "16px 0", display: "grid", gap: 16 }}>
              {/* Metadata Banner */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: "var(--surface-alt)",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  fontSize: 11,
                }}
              >
                {previewing.companyName ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink)" }}>
                    <Building2 size={14} color="var(--blue)" />
                    <strong>{previewing.companyName}</strong>
                  </div>
                ) : null}

                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
                  <Calendar size={14} />
                  <span>
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(previewing.createdAt))}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
                  <User size={14} />
                  <span>{previewing.createdByName || previewing.createdByEmail || "Placement Cell"}</span>
                </div>
              </div>

              {/* Tags */}
              {previewing.tags.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {previewing.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 9999,
                        background: "var(--badge-blue-bg)",
                        color: "var(--blue)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Body text with whitespace preservation */}
              <div
                style={{
                  color: "var(--ink)",
                  fontSize: 13,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  background: "var(--card-bg)",
                  padding: 16,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                }}
              >
                {previewing.content}
              </div>

              {previewing.attachments.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <span className="attachments-label">
                    Attachments ({previewing.attachments.length})
                  </span>
                  <div className="attachment-links">
                    {previewing.attachments.map((file) => (
                      <a
                        key={file.fileUrl}
                        href={file.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Paperclip />
                        {file.fileName}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <footer>
              <button
                type="button"
                onClick={() => {
                  const toEdit = previewing;
                  setPreviewing(null);
                  openEditModal(toEdit);
                }}
              >
                Edit
              </button>
              <button type="button" onClick={() => setPreviewing(null)}>
                Done
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {/* DELETE CONFIRMATION MODAL */}
      {deleting ? (
        <div className="modal-backdrop">
          <form className="modal" action={handleRemove} style={{ width: "min(460px, 100%)" }}>
            <header>
              <div>
                <span className="eyebrow" style={{ color: "var(--badge-red-text)" }}>
                  Confirm Deletion
                </span>
                <h2>Delete Announcement</h2>
              </div>
              <button
                type="button"
                onClick={() => setDeleting(null)}
                aria-label="Close dialog"
              >
                <X />
              </button>
            </header>

            <input type="hidden" name="announcementId" value={deleting.id} />

            <div style={{ padding: "14px 0", fontSize: 12, color: "var(--ink)", lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>&ldquo;{deleting.title}&rdquo;</strong>?
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11 }}>
                This action cannot be undone. The announcement will be immediately removed from student dashboards.
              </p>
            </div>

            <footer>
              <button type="button" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: "var(--badge-red-text)",
                  color: "#fff",
                  border: 0,
                  fontWeight: 700,
                }}
              >
                {saving ? "Deleting…" : "Delete announcement"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
