"use client";

import type { Project } from "@/lib/types";
import { ProjectDot } from "@/components/trainer/badges";
import { Drawer } from "@/components/Drawer";

const PRODUCT_LINE_LABELS: Record<Project["productLine"], string> = {
  denticon: "Denticon",
  cloud9: "Cloud 9",
  internal_admin: "Internal / Admin",
};

/** Read-only slide-in panel showing a project's admin-managed details. Trainers can view but never edit here. */
export function ProjectInfoDrawer({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  return (
    <Drawer open={project !== null} onClose={onClose} title="Project info">
      {project && (
        <>
          <div className="flex items-center gap-2">
            <ProjectDot color={project.color} className="h-3 w-3" />
            <h3 className="text-base font-medium text-brand-darkBlue">
              {project.name}
            </h3>
          </div>
          <p className="mt-0.5 text-sm text-brand-darkBlue/50">
            {PRODUCT_LINE_LABELS[project.productLine]}
          </p>

          <dl className="mt-6 space-y-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-darkBlue/40">
                Project ID
              </dt>
              <dd className="mt-1 text-sm text-brand-darkBlue">
                {project.projectId}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-darkBlue/40">
                BCC email
              </dt>
              <dd className="mt-1 text-sm text-brand-darkBlue">
                {project.bccEmail}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-darkBlue/40">
                Notes
              </dt>
              <dd className="mt-1 text-sm text-brand-darkBlue whitespace-pre-wrap">
                {project.notes || (
                  <span className="text-brand-darkBlue/50">No notes yet.</span>
                )}
              </dd>
            </div>
          </dl>
        </>
      )}
    </Drawer>
  );
}
