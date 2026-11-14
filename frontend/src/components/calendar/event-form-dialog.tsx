"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PortalDialog } from "@/components/common/portal-dialog";
import { StudentSearch } from "@/components/common/student-search";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BackendCalendarOptions, CalendarPerson } from "@/lib/backend-types";
import {
  ATTENDEE_SOURCE_STATUSES,
  calendarEventFormSchema,
  EVENT_TYPE_LABELS,
  STAFF_EVENT_TYPES,
  STAFF_VISIBILITIES,
  VISIBILITY_HINTS,
  VISIBILITY_LABELS,
  type CalendarEventFormValues,
} from "@/lib/calendar-schema";

const NONE = "__none__";

const STATUS_LABELS: Record<(typeof ATTENDEE_SOURCE_STATUSES)[number], string> = {
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview stage",
  APPLIED: "Applied",
  SELECTED: "Selected",
};

function personLabel(person: CalendarPerson) {
  return person.name ?? person.email ?? "Unnamed";
}

function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/** A searchable multi-select for POCs. */
function PocPicker({
  staff,
  value,
  onChange,
}: {
  staff: CalendarPerson[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = staff.filter((person) => value.includes(person.id));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-auto min-h-9 w-full justify-start font-normal">
          <span className={selected.length ? "flex flex-wrap gap-1" : "text-muted-foreground"}>
            {selected.length
              ? selected.map((person) => (
                  <span key={person.id} className="rounded bg-[var(--surface-alt)] px-1.5 py-0.5 text-xs">
                    {personLabel(person)}
                  </span>
                ))
              : "Assign one or more POCs"}
          </span>
          <ChevronDown className="ml-auto opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search the placement team…" />
          <CommandList>
            <CommandEmpty>No staff account matches.</CommandEmpty>
            {staff.map((person) => {
              const active = value.includes(person.id);
              return (
                <CommandItem
                  key={person.id}
                  value={`${person.name ?? ""} ${person.email ?? ""}`}
                  onSelect={() =>
                    onChange(active ? value.filter((id) => id !== person.id) : [...value, person.id])
                  }
                >
                  <Check className={active ? "opacity-100" : "opacity-0"} />
                  <span className="truncate">{personLabel(person)}</span>
                  {person.email && person.name ? (
                    <span className="ml-auto truncate text-xs text-muted-foreground">{person.email}</span>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function EventFormDialog({
  mode,
  initial,
  options,
  onClose,
  onSubmit,
}: {
  mode: "staff" | "student";
  initial: CalendarEventFormValues;
  options: BackendCalendarOptions | null;
  onClose: () => void;
  onSubmit: (values: CalendarEventFormValues) => Promise<string | null>;
}) {
  const [form, setForm] = useState<CalendarEventFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const staff = mode === "staff";
  const editing = Boolean(initial.id);

  const set = <K extends keyof CalendarEventFormValues>(key: K, value: CalendarEventFormValues[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const jobs = useMemo(
    () => (options?.jobs ?? []).filter((job) => !form.companyId || job.companyId === form.companyId),
    [options, form.companyId],
  );
  const attendeeSet = useMemo(() => new Set(form.attendeeIds), [form.attendeeIds]);
  const attendees = useMemo(() => {
    const byId = new Map((options?.students ?? []).map((student) => [student.id, student]));
    return form.attendeeIds.map((id) => byId.get(id) ?? { id, name: null, email: id });
  }, [options, form.attendeeIds]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = calendarEventFormSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the entry details.");
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onSubmit(form);
    setSaving(false);
    if (failure) setError(failure);
  }

  return (
    <PortalDialog
      onClose={onClose}
      eyebrow={staff ? "Placement calendar" : "My calendar"}
      title={editing ? "Edit entry" : staff ? "Add calendar entry" : "Add personal reminder"}
      description={
        staff
          ? "Times are in IST. Choose who can see this entry before saving."
          : "Only you can see your reminders. Times are in IST."
      }
      className="job-profile-modal sm:max-w-[760px]"
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Title" htmlFor="cal-title">
          <Input
            id="cal-title"
            value={form.title}
            maxLength={200}
            autoFocus
            placeholder={staff ? "e.g. Acme Corp campus drive" : "e.g. Prepare for Acme interview"}
            onChange={(event) => set("title", event.target.value)}
          />
        </Field>

        {staff ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type" htmlFor="cal-type">
              <Select value={form.type} onValueChange={(value) => set("type", value as CalendarEventFormValues["type"])}>
                <SelectTrigger id="cal-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {EVENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Company" htmlFor="cal-company">
              <Select
                value={form.companyId ?? NONE}
                onValueChange={(value) => {
                  const companyId = value === NONE ? null : value;
                  setForm((previous) => {
                    const job = options?.jobs.find((item) => item.id === previous.jobProfileId);
                    return {
                      ...previous,
                      companyId,
                      jobProfileId: job && job.companyId === companyId ? previous.jobProfileId : null,
                    };
                  });
                }}
              >
                <SelectTrigger id="cal-company" className="w-full">
                  <SelectValue placeholder="No company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No company</SelectItem>
                  {(options?.companies ?? []).map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Drive (optional)" htmlFor="cal-job">
              <Select
                value={form.jobProfileId ?? NONE}
                onValueChange={(value) => {
                  const jobProfileId = value === NONE ? null : value;
                  const job = options?.jobs.find((item) => item.id === jobProfileId);
                  setForm((previous) => ({
                    ...previous,
                    jobProfileId,
                    companyId: job ? job.companyId : previous.companyId,
                  }));
                }}
              >
                <SelectTrigger id="cal-job" className="w-full">
                  <SelectValue placeholder="No drive" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No drive</SelectItem>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.companyName ? `${job.companyName} — ` : ""}
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}

        <div className="grid gap-3 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={form.allDay} onCheckedChange={(checked) => set("allDay", checked)} />
            All day
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Starts" htmlFor="cal-start-date">
                <Input
                  id="cal-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => {
                    const startDate = event.target.value;
                    setForm((previous) => ({
                      ...previous,
                      startDate,
                      // Moving the start past the end drags the end along.
                      endDate: previous.endDate < startDate ? startDate : previous.endDate,
                    }));
                  }}
                />
              </Field>
              {!form.allDay ? (
                <Field label="Time" htmlFor="cal-start-time">
                  <Input
                    id="cal-start-time"
                    type="time"
                    step={300}
                    value={form.startTime}
                    onChange={(event) => set("startTime", event.target.value)}
                  />
                </Field>
              ) : null}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Ends" htmlFor="cal-end-date">
                <Input
                  id="cal-end-date"
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(event) => set("endDate", event.target.value)}
                />
              </Field>
              {!form.allDay ? (
                <Field label="Time" htmlFor="cal-end-time">
                  <Input
                    id="cal-end-time"
                    type="time"
                    step={300}
                    value={form.endTime}
                    onChange={(event) => set("endTime", event.target.value)}
                  />
                </Field>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" htmlFor="cal-location">
            <Input
              id="cal-location"
              value={form.location ?? ""}
              maxLength={300}
              placeholder="e.g. Seminar Hall, Admin Block"
              onChange={(event) => set("location", event.target.value)}
            />
          </Field>
          <Field label="Meeting link" htmlFor="cal-link">
            <Input
              id="cal-link"
              type="url"
              value={form.meetingLink ?? ""}
              maxLength={1000}
              placeholder="https://meet.google.com/…"
              onChange={(event) => set("meetingLink", event.target.value)}
            />
          </Field>
        </div>

        {staff ? (
          <>
            <Field label="Point of contact">
              <PocPicker staff={options?.staff ?? []} value={form.pocIds} onChange={(next) => set("pocIds", next)} />
            </Field>

            <div className="grid gap-3 rounded-lg border p-3">
              <Field label="Who can see this" htmlFor="cal-visibility">
                <Select
                  value={form.visibility}
                  onValueChange={(value) => set("visibility", value as CalendarEventFormValues["visibility"])}
                >
                  <SelectTrigger id="cal-visibility" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_VISIBILITIES.map((visibility) => (
                      <SelectItem key={visibility} value={visibility}>
                        {VISIBILITY_LABELS[visibility]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{VISIBILITY_HINTS[form.visibility]}</p>
              </Field>

              {form.visibility === "TARGETED" ? (
                <div className="grid gap-3">
                  <Field label="Batches">
                    {options?.batches.length ? (
                      <ToggleGroup
                        type="multiple"
                        variant="outline"
                        className="flex-wrap justify-start"
                        value={form.targetBatches.map(String)}
                        onValueChange={(values) => set("targetBatches", values.map(Number).sort())}
                      >
                        {options.batches.map((batch) => (
                          <ToggleGroupItem key={batch} value={String(batch)} className="px-3">
                            {batch}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    ) : (
                      <p className="text-xs text-muted-foreground">No batches on the roster yet.</p>
                    )}
                  </Field>
                  <Field label="Branches">
                    {options?.branches.length ? (
                      <ToggleGroup
                        type="multiple"
                        variant="outline"
                        className="flex-wrap justify-start"
                        value={form.targetBranches}
                        onValueChange={(values) => set("targetBranches", values.sort())}
                      >
                        {options.branches.map((branch) => (
                          <ToggleGroupItem key={branch} value={branch} className="px-3">
                            {branch}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    ) : (
                      <p className="text-xs text-muted-foreground">No branches on the roster yet.</p>
                    )}
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    Leave a row empty to include everyone on it — for example, pick only 2027 to reach every
                    branch of that batch.
                  </p>
                </div>
              ) : null}

              {form.visibility === "ATTENDEES" ? (
                <div className="grid gap-3">
                  <Field label="Add students">
                    <StudentSearch
                      students={(options?.students ?? []).map((student) => ({
                        id: student.id,
                        name: student.name,
                        email: student.email,
                        rollNumber: student.rollNumber ?? null,
                        branch: student.branch ?? null,
                      }))}
                      disabledIds={attendeeSet}
                      onSelect={(student) => set("attendeeIds", [...form.attendeeIds, student.id])}
                    />
                  </Field>
                  {attendees.length ? (
                    <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                      {attendees.map((person) => (
                        <span
                          key={person.id}
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-alt)] py-0.5 pr-1 pl-2.5 text-xs"
                        >
                          {personLabel(person)}
                          {person.rollNumber ? <span className="text-muted-foreground">({person.rollNumber})</span> : null}
                          <button
                            type="button"
                            className="rounded-full p-0.5 hover:bg-accent"
                            aria-label={`Remove ${personLabel(person)}`}
                            onClick={() => set("attendeeIds", form.attendeeIds.filter((id) => id !== person.id))}
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="grid gap-2 rounded-md bg-[var(--surface-alt)] p-3">
                    <p className="text-sm font-medium">Also add applicants of the selected drive</p>
                    {form.jobProfileId ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {ATTENDEE_SOURCE_STATUSES.map((status) => {
                          const checked = form.attendeeSourceStatuses.includes(status);
                          return (
                            <label key={status} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(next) =>
                                  set(
                                    "attendeeSourceStatuses",
                                    next
                                      ? [...form.attendeeSourceStatuses, status]
                                      : form.attendeeSourceStatuses.filter((item) => item !== status),
                                  )
                                }
                              />
                              {STATUS_LABELS[status]}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Pick a drive above to add everyone at a stage, such as all shortlisted candidates.
                      </p>
                    )}
                    {editing && form.attendeeSourceStatuses.length ? (
                      <p className="text-xs text-muted-foreground">
                        Matching applicants are added to the students already listed.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <Field label={staff ? "Notes" : "Notes (optional)"} htmlFor="cal-description">
          <Textarea
            id="cal-description"
            rows={3}
            maxLength={4000}
            value={form.description ?? ""}
            placeholder={staff ? "Agenda, rounds, what students should bring…" : "Anything you want to remember"}
            onChange={(event) => set("description", event.target.value)}
          />
        </Field>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add to calendar"}
          </Button>
        </div>
      </form>
    </PortalDialog>
  );
}
