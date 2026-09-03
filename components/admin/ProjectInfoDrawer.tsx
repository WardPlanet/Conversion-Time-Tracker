"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Project, ProductLine } from "@/lib/types";
import { Drawer } from "@/components/Drawer";
import { useToast } from "@/components/ToastProvider";

const PRODUCT_LINE_LABELS: Record<ProductLine, string> = {
  denticon: "Denticon",
  cloud9: "Cloud 9",
  internal_admin: "Internal / Admin",
};

function formFromProject(project: Project) {
  return {
    name: project.name,
    productLine: project.productLine,
    color: project.color,
    projectId: project.projectId,
    bccEmail: project.bccEmail,
    notes: project.notes ?? "",
  };
}

/** Admin's editable counterpart to the trainer's read-only Project info drawer — same layout, but every field here can be changed and saved. */
export function ProjectInfoDrawer({
  project,
  onClose,
  onSaved,
}: {
  project: Project | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => project && formFromProject(project));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastProjectId = useRef<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (project && project.id !== lastProjectId.current) {
      lastProjectId.current = project.id;
      setForm(formFromProject(project));
      setError(null);
    }
  }, [project]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !form) return;
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to update project.");
        return;
      }

      showToast({ message: "Project details saved." });
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={project !== null} onClose={onClose} title="Project info">
      {project && form && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Project name
            </span>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) =>
                setForm((f) => f && { ...f, name: e.target.value })
              }
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
                setForm(
                  (f) => f && { ...f, productLine: e.target.value as ProductLine }
                )
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

          <label className="block">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Color
            </span>
            <input
              type="color"
              value={form.color}
              onChange={(e) =>
                setForm((f) => f && { ...f, color: e.target.value })
              }
              className="mt-1 h-[38px] w-14 rounded-md border border-brand-darkBlue/20"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Project ID (client-facing)
            </span>
            <input
              type="text"
              required
              value={form.projectId}
              onChange={(e) =>
                setForm((f) => f && { ...f, projectId: e.target.value })
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
              value={form.bccEmail}
              onChange={(e) =>
                setForm((f) => f && { ...f, bccEmail: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Notes (optional)
            </span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => f && { ...f, notes: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </Drawer>
  );
}
