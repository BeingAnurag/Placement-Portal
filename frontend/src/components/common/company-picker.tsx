"use client";

import { Command } from "cmdk";
import { Building2, ChevronDown, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Searchable company picker backed by `cmdk`.
 *
 * The chosen value is submitted through a hidden input, so the surrounding
 * form keeps posting a single plain field and server-side Zod validation stays
 * the only source of the company rules. With `allowCustom`, a name that is not
 * in `options` can still be entered, which the interview-experience workflow
 * requires for off-campus and pooled-campus recruiters (see docs/DECISIONS.md,
 * 2026-09-15).
 */
export function CompanyPicker({
  name,
  options,
  defaultValue = "",
  placeholder = "Select a company",
  allowCustom = true,
}: {
  name: string;
  options: readonly string[];
  defaultValue?: string;
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function commit(next: string) {
    setValue(next);
    setSearch("");
    setOpen(false);
  }

  const typed = search.trim();
  const canUseTyped =
    allowCustom &&
    typed.length >= 2 &&
    !options.some((option) => option.toLowerCase() === typed.toLowerCase());

  return (
    <>
      <input type="hidden" name={name} value={value} />

      <button type="button" className="company-picker-trigger" onClick={() => setOpen(true)}>
        <span className={value ? "company-picker-value" : "company-picker-placeholder"}>
          <Building2 size={14} />
          {value || placeholder}
        </span>
        <ChevronDown size={14} />
      </button>

      {/* Portalled to the body: this picker is used inside other modals, whose
          backdrop-filter would otherwise become the containing block for the
          fixed-position backdrop below. */}
      {open &&
        createPortal(
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
          <Command className="modal company-picker-modal" label="Select a company">
            <header className="company-picker-header">
              <h2>Select a company</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close company picker">
                <X size={16} />
              </button>
            </header>

            <div className="company-picker-search">
              <Search size={14} />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search companies..."
                autoFocus
              />
            </div>

            <Command.List className="company-picker-list">
              {!canUseTyped && (
                <Command.Empty className="company-picker-empty">
                  No company matches &ldquo;{typed}&rdquo;.
                </Command.Empty>
              )}

              {canUseTyped && (
                <Command.Item
                  forceMount
                  value={typed}
                  onSelect={() => commit(typed)}
                  className="company-picker-item company-picker-item-custom"
                >
                  <Plus size={14} />
                  Use &ldquo;{typed}&rdquo;
                </Command.Item>
              )}

              {options.map((option) => (
                <Command.Item
                  key={option}
                  value={option}
                  onSelect={() => commit(option)}
                  className="company-picker-item"
                >
                  {option}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
          </div>,
          document.body,
        )}
    </>
  );
}
