import { store } from "@/lib/data";
import { ProjectDot, TaskStatusTag } from "@/components/trainer/badges";
import { displayTaskTitle } from "@/lib/domain/tasks";

export default async function TrainerChecklistTab({
  params,
}: {
  params: { id: string };
}) {
  const [tasks, projects] = await Promise.all([
    store.listTasksForTrainer(params.id),
    store.listProjects(),
  ]);

  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const projectIds = Array.from(new Set(tasks.map((t) => t.projectId)));

  return (
    <div>
      <h2 className="text-lg font-medium">Projects / Checklist</h2>
      {projectIds.length === 0 ? (
        <p className="mt-3 text-sm text-brand-darkBlue/60">
          No checklist tasks yet.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {projectIds.map((projectId) => {
            const project = projectsById.get(projectId) ?? null;
            const projectTasks = tasks.filter((t) => t.projectId === projectId);
            const completedCount = projectTasks.filter(
              (t) => t.status === "completed"
            ).length;
            const progressPercent =
              projectTasks.length === 0
                ? 0
                : Math.round((completedCount / projectTasks.length) * 100);

            return (
              <section
                key={projectId}
                className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6"
              >
                <div className="flex items-center gap-2">
                  {project && (
                    <ProjectDot color={project.color} className="h-3 w-3" />
                  )}
                  <h3 className="font-medium">
                    {project?.name ?? "Unknown project"}
                  </h3>
                </div>

                <p className="mt-2 text-sm text-brand-darkBlue/60">
                  {completedCount} of {projectTasks.length} tasks complete
                </p>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-brand-blueWater">
                  <div
                    className="h-full rounded-full bg-brand-blue"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <ul className="mt-4 space-y-2">
                  {projectTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between rounded-md border border-brand-darkBlue/10 px-3 py-2"
                    >
                      <span className="text-sm">{displayTaskTitle(task)}</span>
                      <TaskStatusTag status={task.status} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
