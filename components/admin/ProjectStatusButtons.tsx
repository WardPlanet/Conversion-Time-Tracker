"use client";

import { useState } from "react";
import type { Project, ProjectStatus } from "@/lib/types";

const STATUS_BUTTONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Mark Active" },
  { value: "on_hold", label: "Put On Hold" },
  { value: "completed", label: "Mark Completed" },
  { value: "deactivated", label: "Deactivate" },
];

/**
 * The single place a project's status is changed — every status list
 * (Active/On Hold main sections, the Archive) renders the same four
 * buttons so reactivating an archived project works identically to
 * putting an active one on hold.
 */
export function ProjectStatusButtons({
  project,
  onChanged,
}: {
  project: Project;
  onChanged: (project: Project) => void;
}) {
  const [pending, setPending] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: ProjectStatus) {
    if (status === project.status || pending) return;
    setError(null);
    setPending(status);
    try {
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to update project status.");
        return;
      }
      onChanged(data.project);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {STATUS_BUTTONS.map((btn) => {
          const isCurrent = project.status === btn.value;
          return (
            <button
              key={btn.value}
              type="button"
              disabled={isCurrent || pending !== null}
              onClick={() => setStatus(btn.value)}
              className={
                isCurrent
                  ? "rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-xs font-medium hover:bg-brand-blueWater disabled:opacity-50"
              }
            >
              {pending === btn.value ? "Saving…" : btn.label}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
