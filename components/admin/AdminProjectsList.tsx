"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";
import { ProjectDot, ProjectStatusTag } from "@/components/trainer/badges";
import { ProjectInfoButton } from "@/components/admin/ProjectInfoButton";
import { AddProjectForm } from "@/components/admin/AddProjectForm";
import { Modal } from "@/components/Modal";

const PRODUCT_LINE_LABELS: Record<Project["productLine"], string> = {
  denticon: "Denticon",
  cloud9: "Cloud 9",
  internal_admin: "Internal / Admin",
};

function ProjectRow({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-brand-darkBlue/10 bg-white shadow-sm px-4 py-3">
      <Link
        href={`/admin/projects/${project.id}`}
        className="flex flex-1 items-center gap-2 hover:opacity-80"
      >
        <ProjectDot color={project.color} />
        <span className="font-medium">{project.name}</span>
        <span className="text-xs text-brand-darkBlue/50">
          {PRODUCT_LINE_LABELS[project.productLine]}
        </span>
      </Link>
      <ProjectStatusTag status={project.status} />
      <ProjectInfoButton project={project} onSaved={onSaved} />
    </li>
  );
}

/** Client-side list so a saved Project Info edit (or a newly-created project) can refresh in place, without a full page reload. */
export function AdminProjectsList({
  initialProjects,
}: {
  initialProjects: Project[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [showArchive, setShowArchive] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);

  async function refresh() {
    const response = await fetch("/api/admin/projects");
    const data = await response.json();
    setProjects(data.projects ?? []);
  }

  function handleCreated() {
    setShowAddProject(false);
    refresh();
  }

  const activeProjects = projects.filter((p) => p.status === "active");
  const onHoldProjects = projects.filter((p) => p.status === "on_hold");
  const archivedProjects = projects.filter(
    (p) => p.status === "completed" || p.status === "deactivated"
  );

  return (
    <div>
      <button
        onClick={() => setShowAddProject(true)}
        className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
      >
        Add Project
      </button>

      <Modal
        open={showAddProject}
        onClose={() => setShowAddProject(false)}
        title="Add project"
      >
        <AddProjectForm onCreated={handleCreated} enableTrainerAssignment />
      </Modal>

      <div className="mt-6">
        {activeProjects.length === 0 ? (
          <p className="text-sm text-brand-darkBlue/60">No active projects yet.</p>
        ) : (
          <ul className="space-y-2">
            {activeProjects.map((project) => (
              <ProjectRow key={project.id} project={project} onSaved={refresh} />
            ))}
          </ul>
        )}
      </div>

      {onHoldProjects.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-brand-darkBlue/70">On Hold</h3>
          <ul className="mt-2 space-y-2">
            {onHoldProjects.map((project) => (
              <ProjectRow key={project.id} project={project} onSaved={refresh} />
            ))}
          </ul>
        </div>
      )}

      {archivedProjects.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchive((s) => !s)}
            className="text-sm text-brand-darkBlue/60 hover:text-brand-darkBlue"
          >
            {showArchive ? "Hide" : "Archive"} ({archivedProjects.length})
          </button>
          {showArchive && (
            <ul className="mt-2 space-y-2">
              {archivedProjects.map((project) => (
                <ProjectRow key={project.id} project={project} onSaved={refresh} />
              ))}
            </ul>
          )}
        </div>
      )}

      {projects.length === 0 && (
        <p className="mt-6 text-sm text-brand-darkBlue/60">No projects yet.</p>
      )}
    </div>
  );
}
