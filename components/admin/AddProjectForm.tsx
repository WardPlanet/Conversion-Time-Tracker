"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import type { PublicUser, Project, ProductLine } from "@/lib/types";
import { STANDARD_TASKS, displayTaskTitle } from "@/lib/domain/tasks";

const PRODUCT_LINE_LABELS: Record<ProductLine, string> = {
  denticon: "Denticon",
  cloud9: "Cloud 9",
  internal_admin: "Internal / Admin",
};

/** Fixed palette a project's color is picked from — swaps out the old free-form gradient/RGB picker for a small, consistent set of options. */
const PROJECT_COLOR_SWATCHES = [
  { hex: "#3a5cf5", name: "Blue" },
  { hex: "#16a34a", name: "Green" },
  { hex: "#ea580c", name: "Orange" },
  { hex: "#db2777", name: "Pink" },
  { hex: "#9333ea", name: "Purple" },
  { hex: "#0891b2", name: "Teal" },
  { hex: "#ca8a04", name: "Gold" },
  { hex: "#dc2626", name: "Red" },
  { hex: "#4f46e5", name: "Indigo" },
  { hex: "#65a30d", name: "Olive" },
];

function emptyForm() {
  return {
    name: "",
    productLine: "denticon" as ProductLine,
    color: PROJECT_COLOR_SWATCHES[0].hex,
    projectId: "",
    bccEmail: "",
    notes: "",
  };
}

function ColorSwatchDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected =
    PROJECT_COLOR_SWATCHES.find((c) => c.hex === value) ??
    PROJECT_COLOR_SWATCHES[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md border border-brand-darkBlue/20 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      >
        <span
          className="h-4 w-4 shrink-0 rounded-full"
          style={{ backgroundColor: selected.hex }}
        />
        <span className="flex-1 text-left text-brand-darkBlue">
          {selected.name}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-brand-darkBlue/50" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full rounded-md border border-brand-darkBlue/10 bg-white py-1 shadow-lg"
        >
          {PROJECT_COLOR_SWATCHES.map((color) => {
            const isSelected = color.hex === selected.hex;
            return (
              <li key={color.hex}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(color.hex);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-brand-blueWater ${
                    isSelected ? "font-medium text-brand-darkBlue" : "text-brand-darkBlue/80"
                  }`}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: color.hex }}
                  />
                  {color.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Add-project form, shared by the Settings page and the dashboard's Quick
 * Actions modal. The optional trainer/task assignment section (only shown
 * when `enableTrainerAssignment` is set) is Settings-only — Quick Actions
 * keeps its original, lighter-weight form untouched.
 */
export function AddProjectForm({
  onCreated,
  enableTrainerAssignment = false,
}: {
  onCreated?: (project: Project) => void;
  enableTrainerAssignment?: boolean;
}) {
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [trainers, setTrainers] = useState<PublicUser[]>([]);
  // Presence of a trainerId as a key means that trainer is checked; the Set
  // value holds `StandardTaskTemplate.key`s (not titles — two templates
  // share the title "On-Site Customer Support") for which standard tasks
  // apply to them.
  const [assignments, setAssignments] = useState<Map<string, Set<string>>>(
    new Map()
  );

  useEffect(() => {
    if (!enableTrainerAssignment) return;
    fetch("/api/admin/trainers")
      .then((r) => r.json())
      .then((data) => setTrainers((data.trainers ?? []).filter((t: PublicUser) => t.active)));
  }, [enableTrainerAssignment]);

  function toggleTrainer(trainerId: string) {
    setAssignments((prev) => {
      const next = new Map(prev);
      if (next.has(trainerId)) {
        next.delete(trainerId);
      } else {
        // Newly checking a trainer starts with none of the 5 standard
        // tasks selected — the admin actively picks which apply, or hits
        // "Select all" for the full checklist.
        next.set(trainerId, new Set());
      }
      return next;
    });
  }

  function toggleTask(trainerId: string, key: string) {
    setAssignments((prev) => {
      const next = new Map(prev);
      const keys = new Set(next.get(trainerId) ?? []);
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
      next.set(trainerId, keys);
      return next;
    });
  }

  function toggleSelectAll(trainerId: string) {
    setAssignments((prev) => {
      const next = new Map(prev);
      const keys = next.get(trainerId) ?? new Set<string>();
      next.set(
        trainerId,
        keys.size === STANDARD_TASKS.length
          ? new Set()
          : new Set(STANDARD_TASKS.map((t) => t.key))
      );
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to add project.");
        return;
      }

      const project: Project = data.project;

      for (const [trainerId, keys] of assignments) {
        for (const key of keys) {
          const template = STANDARD_TASKS.find((t) => t.key === key);
          if (!template) continue;
          const taskResponse = await fetch("/api/admin/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: project.id,
              title: template.title,
              billable: template.billable,
              trainerId,
            }),
          });
          if (!taskResponse.ok) {
            setError(
              "Project was created, but assigning some tasks failed. Use “Manage offices & tasks” to finish assigning them."
            );
          }
        }
      }

      setForm(emptyForm());
      setAssignments(new Map());
      onCreated?.(project);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <label className="block sm:col-span-2">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Project name
        </span>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Product line
        </span>
        <select
          value={form.productLine}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              productLine: e.target.value as ProductLine,
            }))
          }
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          {Object.entries(PRODUCT_LINE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">Color</span>
        <ColorSwatchDropdown
          value={form.color}
          onChange={(hex) => setForm((f) => ({ ...f, color: hex }))}
        />
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Project ID (client-facing)
        </span>
        <input
          type="text"
          required
          placeholder="e.g. BSN-2026"
          value={form.projectId}
          onChange={(e) =>
            setForm((f) => ({ ...f, projectId: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          BCC email
        </span>
        <input
          type="email"
          required
          placeholder="notifications@example.com"
          value={form.bccEmail}
          onChange={(e) =>
            setForm((f) => ({ ...f, bccEmail: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      <label className="block sm:col-span-2">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Notes (optional)
        </span>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      {enableTrainerAssignment && (
        <div className="sm:col-span-2">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Assign trainers (optional)
          </span>
          <p className="mt-1 text-xs text-brand-darkBlue/50">
            Every project draws from the same 5-task standard checklist.
            Check a trainer, then check which of those 5 apply to them —
            or skip this and assign tasks later via “Manage offices &amp;
            tasks.”
          </p>

          <div className="mt-3 space-y-3">
            {trainers.map((trainer) => {
              const selected = assignments.get(trainer.id);
              const isChecked = selected !== undefined;
              const allSelected = selected?.size === STANDARD_TASKS.length;

              return (
                <div
                  key={trainer.id}
                  className="rounded-md border border-brand-darkBlue/10 p-3"
                >
                  <label className="flex items-center gap-2 text-sm font-medium text-brand-darkBlue">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleTrainer(trainer.id)}
                      className="h-4 w-4 rounded border-brand-darkBlue/20"
                    />
                    {trainer.name}
                  </label>

                  {isChecked && (
                    <div className="mt-2 ml-6">
                      <button
                        type="button"
                        onClick={() => toggleSelectAll(trainer.id)}
                        className="text-xs font-medium text-brand-blue hover:underline"
                      >
                        {allSelected ? "Deselect all" : "Select all"}
                      </button>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {STANDARD_TASKS.map((template) => (
                          <label
                            key={template.key}
                            className="flex items-center gap-1.5 text-xs text-brand-darkBlue/80"
                          >
                            <input
                              type="checkbox"
                              checked={selected?.has(template.key) ?? false}
                              onChange={() => toggleTask(trainer.id, template.key)}
                              className="h-3.5 w-3.5 rounded border-brand-darkBlue/20"
                            />
                            {displayTaskTitle(template)}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add project"}
        </button>
      </div>
    </form>
  );
}
