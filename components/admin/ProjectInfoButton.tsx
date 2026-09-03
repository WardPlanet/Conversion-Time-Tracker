"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import type { Project } from "@/lib/types";
import { ProjectInfoDrawer } from "@/components/admin/ProjectInfoDrawer";

/**
 * Opens the admin's editable Project info drawer for a single project.
 * Shared by the Settings project list, the admin Projects list, and the
 * project detail page — each passes its own `onSaved` refresh strategy
 * (a local refetch, or `router.refresh()` on a Server Component page).
 */
export function ProjectInfoButton({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md border border-brand-darkBlue/20 px-2 py-1 text-xs font-medium hover:bg-brand-blueWater"
      >
        <Info className="h-3.5 w-3.5" />
        Project Info
      </button>
      <ProjectInfoDrawer
        project={open ? project : null}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          onSaved();
        }}
      />
    </>
  );
}
