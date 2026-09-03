"use client";

import { useEffect, useState } from "react";
import type { Office, Project } from "@/lib/types";
import { AddOfficeForm } from "@/components/admin/AddOfficeForm";

/** Project-picker step in front of {@link AddOfficeForm}, for contexts (like the dashboard) with no project already in scope. */
export function AddOfficeFlow({
  onCreated,
}: {
  onCreated?: (office: Office) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(
          (data.projects ?? []).filter(
            (p: Project) => p.status === "active" || p.status === "on_hold"
          )
        );
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <label className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Project
        </span>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={loading}
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-blueWater disabled:text-brand-darkBlue/50"
        >
          <option value="">
            {loading ? "Loading projects…" : "Select a project"}
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {projectId && (
        <div className="mt-4">
          <AddOfficeForm projectId={projectId} onCreated={onCreated} />
        </div>
      )}
    </div>
  );
}
