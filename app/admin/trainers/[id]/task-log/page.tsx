import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { store } from "@/lib/data";
import { TrainerWeeklyTaskLog } from "@/components/admin/TrainerWeeklyTaskLog";

export default async function TrainerTaskLogTab({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) notFound();
  const actor = { id: session.userId, role: session.role };

  const [entries, allProjects, tasks, submissions] = await Promise.all([
    store.listTaskEntriesForTrainer(params.id),
    store.listProjects(),
    store.listTasksForTrainer(params.id),
    store.listWeeklySubmissionsForTrainer(params.id, actor),
  ]);

  const projectsById = new Map(allProjects.map((p) => [p.id, p]));
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const enrichedEntries = entries.map((e) => ({
    ...e,
    project: projectsById.get(e.projectId) ?? null,
    task: tasksById.get(e.taskId) ?? null,
  }));

  return (
    <div>
      <h2 className="text-lg font-medium">Task Log</h2>
      <TrainerWeeklyTaskLog
        projects={allProjects}
        entries={enrichedEntries}
        submissions={submissions}
      />
    </div>
  );
}
