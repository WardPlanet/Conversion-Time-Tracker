import Link from "next/link";
import { notFound } from "next/navigation";
import { store } from "@/lib/data";
import { ProjectDot, TaskStatusTag } from "@/components/trainer/badges";
import { ProjectInfoButtonRefresh } from "@/components/admin/ProjectInfoButtonRefresh";
import { ProjectStatusButtonsRefresh } from "@/components/admin/ProjectStatusButtonsRefresh";
import { OfficesManager } from "@/components/admin/OfficesManager";
import { TasksManager } from "@/components/admin/TasksManager";
import { displayTaskTitle } from "@/lib/domain/tasks";

const PRODUCT_LINE_LABELS = {
  denticon: "Denticon",
  cloud9: "Cloud 9",
  internal_admin: "Internal / Admin",
} as const;

export default async function AdminProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const project = await store.getProject(params.id);
  if (!project) notFound();

  const [allTasks, allEntries, trainers] = await Promise.all([
    store.listAllTasks(),
    store.listAllTaskEntries(),
    store.listTrainers(),
  ]);

  const trainersById = new Map(trainers.map((t) => [t.id, t]));
  const tasks = allTasks.filter((t) => t.projectId === project.id);
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const entries = allEntries
    .filter((e) => e.projectId === project.id)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
    );

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const progressPercent =
    tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  const trainerIds = Array.from(new Set(tasks.map((t) => t.trainerId)));
  const breakdown = trainerIds.map((trainerId) => {
    const trainerTasks = tasks.filter((t) => t.trainerId === trainerId);
    const trainerCompleted = trainerTasks.filter(
      (t) => t.status === "completed"
    ).length;
    return {
      trainerId,
      trainer: trainersById.get(trainerId) ?? null,
      completed: trainerCompleted,
      total: trainerTasks.length,
    };
  });

  return (
    <div>
      <Link
        href="/admin/projects"
        className="text-sm text-brand-darkBlue/60 hover:text-brand-darkBlue"
      >
        ← Projects
      </Link>

      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ProjectDot color={project.color} className="h-3 w-3" />
          <h1 className="text-2xl font-semibold text-brand-blue">{project.name}</h1>
          <span className="text-xs text-brand-darkBlue/50">
            {PRODUCT_LINE_LABELS[project.productLine]}
          </span>
        </div>
        <ProjectInfoButtonRefresh project={project} />
      </div>

      <div className="mt-3">
        <ProjectStatusButtonsRefresh project={project} />
      </div>

      <section className="mt-6 rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6">
        <h2 className="text-lg font-medium">Manage offices &amp; tasks</h2>
        <div className="mt-4">
          <OfficesManager projectId={project.id} />
        </div>
        <div className="mt-6">
          <TasksManager projectId={project.id} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6">
        <h2 className="text-lg font-medium">Progress</h2>
        <p className="mt-2 text-sm text-brand-darkBlue/60">
          {completedCount} of {tasks.length} tasks complete
        </p>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-brand-blueWater">
          <div
            className="h-full rounded-full bg-brand-blue"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-4 space-y-2">
          {breakdown.length === 0 ? (
            <p className="text-sm text-brand-darkBlue/60">No trainers assigned yet.</p>
          ) : (
            breakdown.map((b) => (
              <div
                key={b.trainerId}
                className="flex items-center justify-between text-sm"
              >
                <Link
                  href={`/admin/trainers/${b.trainerId}`}
                  className="text-brand-blue hover:underline"
                >
                  {b.trainer?.name ?? "Unknown trainer"}
                </Link>
                <span className="text-brand-darkBlue/60">
                  {b.completed} of {b.total} complete
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-6 rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6">
        <h2 className="text-lg font-medium">Tasks</h2>
        <ul className="mt-3 space-y-2">
          {tasks.length === 0 && (
            <li className="text-sm text-brand-darkBlue/60">No tasks yet.</li>
          )}
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center justify-between rounded-md border border-brand-darkBlue/10 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{displayTaskTitle(task)}</p>
                <Link
                  href={`/admin/trainers/${task.trainerId}`}
                  className="text-xs text-brand-blue hover:underline"
                >
                  {trainersById.get(task.trainerId)?.name ?? "Unknown trainer"}
                </Link>
              </div>
              <TaskStatusTag status={task.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Task Tracker log</h2>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-brand-darkBlue/60">No log entries yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {entries.map((entry) => {
              const task = tasksById.get(entry.taskId) ?? null;
              const trainer = trainersById.get(entry.trainerId) ?? null;
              return (
                <li
                  key={entry.id}
                  className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <Link
                      href={`/admin/trainers/${entry.trainerId}`}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {trainer?.name ?? "Unknown trainer"}
                    </Link>
                    <span className="text-sm text-brand-darkBlue/60">
                      {entry.date}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-sm text-brand-darkBlue/60">
                      {entry.office} ·{" "}
                      {task ? displayTaskTitle(task) : "Unknown task"}
                    </p>
                    {task && <TaskStatusTag status={task.status} />}
                  </div>
                  <p className="mt-2 text-sm text-brand-darkBlue/80">{entry.note}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
