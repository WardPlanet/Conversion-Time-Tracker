"use client";

import { useRouter } from "next/navigation";
import type { Project } from "@/lib/types";
import { ProjectStatusButtons } from "@/components/admin/ProjectStatusButtons";

/** ProjectStatusButtons for a Server Component page — refetches the page's server data after a change instead of local client state. */
export function ProjectStatusButtonsRefresh({ project }: { project: Project }) {
  const router = useRouter();
  return (
    <ProjectStatusButtons project={project} onChanged={() => router.refresh()} />
  );
}
