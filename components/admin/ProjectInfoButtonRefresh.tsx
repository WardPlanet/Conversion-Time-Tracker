"use client";

import { useRouter } from "next/navigation";
import type { Project } from "@/lib/types";
import { ProjectInfoButton } from "@/components/admin/ProjectInfoButton";

/** Project Info button for a Server Component page — refetches the page's server data after a save instead of a local client refetch. */
export function ProjectInfoButtonRefresh({ project }: { project: Project }) {
  const router = useRouter();
  return (
    <ProjectInfoButton project={project} onSaved={() => router.refresh()} />
  );
}
