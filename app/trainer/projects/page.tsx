"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { ChevronDown, Info } from "lucide-react";
import type { Project, Task } from "@/lib/types";
import { ProjectDot, ProjectStatusTag } from "@/components/trainer/badges";
import { computeProjectTaskProgress } from "@/lib/domain/dashboard-insights";
import { displayTaskTitle } from "@/lib/domain/tasks";
import { ProjectInfoDrawer } from "@/components/trainer/ProjectInfoDrawer";

export default function TrainerProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Collapsed by default; any number of projects may be expanded at once.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [infoProject, setInfoProject] = useState<Project | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  function toggleExpanded(projectId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  async function load() {
    setLoading(true);
    const response = await fetch("/api/trainer/projects");
    const data = await response.json();
    setProjects(data.projects ?? []);
    setTasks(data.tasks ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleComplete(task: Task) {
    setError(null);
    const nextStatus = task.status === "completed" ? "not_started" : "completed";

    const response = await fetch(`/api/trainer/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Failed to update task.");
      return;
    }

    await load();
  }

  const progressByProjectId = new Map(
    computeProjectTaskProgress(tasks, projects).map((p) => [p.project.id, p])
  );

  const activeProjects = projects.filter((p) => p.status === "active");
  const onHoldProjects = projects.filter((p) => p.status === "on_hold");
  const archivedProjects = projects.filter(
    (p) => p.status === "completed" || p.status === "deactivated"
  );

  function renderSection(list: Project[], readOnly: boolean) {
    return (
      <div className="space-y-6">
        {list.map((project) => {
          const projectTasks = tasks.filter((t) => t.projectId === project.id);
          const progress = progressByProjectId.get(project.id);
          const completedCount = progress?.completedCount ?? 0;
          const progressPercent = progress?.progressPercent ?? 0;
          const isExpanded = expandedIds.has(project.id);

          return (
            <section
              key={project.id}
              className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleExpanded(project.id)}
                onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleExpanded(project.id);
                  }
                }}
                aria-expanded={isExpanded}
                className="w-full cursor-pointer p-6 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ProjectDot color={project.color} className="h-3 w-3" />
                    <h2 className="text-lg font-medium">{project.name}</h2>
                    <span className="text-xs text-brand-darkBlue/50">
                      {project.productLine}
                    </span>
                    {readOnly && <ProjectStatusTag status={project.status} />}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoProject(project);
                      }}
                      className="flex items-center gap-1 rounded-md border border-brand-darkBlue/20 px-2 py-1 text-xs font-medium hover:bg-brand-blueWater"
                    >
                      <Info className="h-3.5 w-3.5" />
                      Project Info
                    </button>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-brand-darkBlue/50 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-sm text-brand-darkBlue/60">
                    {completedCount} of {projectTasks.length} tasks complete
                  </p>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-brand-blueWater">
                    <div
                      className="h-full rounded-full bg-brand-blue transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-brand-darkBlue/10 px-6 pb-6 pt-4">
                  <ul className="space-y-2">
                    {projectTasks.length === 0 && (
                      <li className="text-sm text-brand-darkBlue/60">
                        No tasks yet.
                      </li>
                    )}
                    {projectTasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center gap-3 rounded-md border border-brand-darkBlue/10 px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={task.status === "completed"}
                          disabled={readOnly}
                          onChange={() => toggleComplete(task)}
                          className="h-4 w-4 rounded border-brand-darkBlue/20 disabled:opacity-50"
                        />
                        <span
                          className={
                            task.status === "completed"
                              ? "text-sm text-brand-darkBlue/50 line-through"
                              : "text-sm text-brand-darkBlue"
                          }
                        >
                          {displayTaskTitle(task)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Projects</h1>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        Track progress against each project&apos;s task checklist.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-brand-darkBlue/60">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="mt-4 text-sm text-brand-darkBlue/60">
          No assigned projects yet.
        </p>
      ) : (
        <>
          {activeProjects.length === 0 ? (
            <p className="mt-6 text-sm text-brand-darkBlue/60">
              No active projects.
            </p>
          ) : (
            <div className="mt-6">{renderSection(activeProjects, false)}</div>
          )}

          <div className="mt-8">
            <h2 className="text-lg font-medium text-brand-darkBlue">
              On Hold
            </h2>
            {onHoldProjects.length === 0 ? (
              <p className="mt-2 text-sm text-brand-darkBlue/60">
                No projects on hold.
              </p>
            ) : (
              <div className="mt-3">{renderSection(onHoldProjects, false)}</div>
            )}
          </div>

          <div className="mt-8 border-t border-brand-darkBlue/10 pt-4">
            <button
              type="button"
              onClick={() => setShowArchive((v) => !v)}
              className="text-sm font-medium text-brand-blue hover:underline"
            >
              {showArchive
                ? "Hide archive"
                : `Archive (${archivedProjects.length})`}
            </button>

            {showArchive && (
              <div className="mt-3">
                <p className="text-xs text-brand-darkBlue/50">
                  Completed and deactivated projects, shown for reference —
                  task checklists here are read-only.
                </p>
                <div className="mt-3">
                  {archivedProjects.length === 0 ? (
                    <p className="text-sm text-brand-darkBlue/60">
                      Nothing archived yet.
                    </p>
                  ) : (
                    renderSection(archivedProjects, true)
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <ProjectInfoDrawer
        project={infoProject}
        onClose={() => setInfoProject(null)}
      />
    </div>
  );
}
