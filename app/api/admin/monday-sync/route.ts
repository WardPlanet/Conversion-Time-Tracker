import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/api-auth";
import { store } from "@/lib/data";
import {
  syncAll,
  mondayConfigStatus,
  isMondayConfigured,
  type MondayTimeEntryRow,
  type MondayExpenseRow,
  type MondayTimesheetRow,
} from "@/lib/integrations/monday";
import { weekStartDateFor } from "@/lib/domain/weekly-submissions";
import { computeWorkedMs, msToHours } from "@/lib/domain/worked-hours";
import { addDays } from "date-fns";

// In-memory last-sync state. Resets on server restart — will persist
// automatically once this app moves to a real database.
let lastSync: {
  timestamp: string;
  success: boolean;
  message: string;
  timeEntries: { synced: number; errors: number };
  expenses: { synced: number; errors: number };
  timesheets: { synced: number; errors: number };
} | null = null;

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  return NextResponse.json({
    configured: isMondayConfigured(),
    configStatus: mondayConfigStatus(),
    lastSync,
  });
}

export async function POST() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;
  const actor = { id: auth.session.userId, role: auth.session.role };

  const [allEntries, projects, tasks, trainers] = await Promise.all([
    store.listAllTaskEntries(),
    store.listProjects(),
    store.listAllTasks(),
    store.listTrainers(),
  ]);

  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const trainersById = new Map(trainers.map((t) => [t.id, t]));

  // Per-trainer weekly submission statuses for time entry week status
  const subsByTrainer = new Map<string, Awaited<ReturnType<typeof store.listWeeklySubmissionsForTrainer>>>();
  await Promise.all(
    trainers.map(async (t) => {
      const subs = await store.listWeeklySubmissionsForTrainer(t.id, actor);
      subsByTrainer.set(t.id, subs);
    })
  );

  const timeEntryRows: MondayTimeEntryRow[] = allEntries.map((e) => {
    const project = projectsById.get(e.projectId);
    const task = tasksById.get(e.taskId);
    const trainer = trainersById.get(e.trainerId);
    const weekStart = weekStartDateFor(e.date);
    const subs = subsByTrainer.get(e.trainerId) ?? [];
    const sub = subs.find((s) => s.weekStartDate === weekStart);
    const trainerName = trainer?.name ?? e.trainerId;
    return {
      itemName: `${trainerName} – ${project?.name ?? e.projectId} – ${e.date}`,
      trainer: trainerName,
      project: project?.name ?? e.projectId,
      task: task?.title ?? e.taskId,
      date: e.date,
      hours: e.hours,
      location: e.location ?? "",
      office: e.office,
      note: e.note,
      billable: task?.billable ?? false,
      weekStatus: sub?.status ?? "draft",
    };
  });

  // Expenses
  const allExpenses = (
    await Promise.all(
      trainers.map(async (t) => {
        const expenses = await store.listExpensesForTrainer(t.id, actor);
        return expenses.map((e) => ({ ...e, trainerName: t.name }));
      })
    )
  ).flat();

  const expenseRows: MondayExpenseRow[] = allExpenses.map((e) => ({
    itemName: `${e.trainerName} – ${e.category} – ${e.date}`,
    trainer: e.trainerName,
    project: e.projectId ? (projectsById.get(e.projectId)?.name ?? e.projectId) : "",
    date: e.date,
    category: e.category,
    amount: e.amount,
    description: e.description,
    status: e.status,
    rejectionReason: e.rejectionReason ?? "",
    submittedAt: e.createdAt,
  }));

  // Timesheets
  const timesheetRows: MondayTimesheetRow[] = [];
  await Promise.all(
    trainers.map(async (trainer) => {
      const [submissions, events] = await Promise.all([
        store.listTimesheetSubmissionsForTrainer(trainer.id, actor),
        store.listTimeClockEvents(trainer.id),
      ]);
      for (const sub of submissions) {
        const weekStart = new Date(sub.weekStartDate);
        const weekEnd = addDays(weekStart, 5);
        const totalHours = msToHours(computeWorkedMs(events, weekStart, weekEnd));
        timesheetRows.push({
          itemName: `${trainer.name} – Week of ${sub.weekStartDate}`,
          trainer: trainer.name,
          weekStart: sub.weekStartDate,
          totalHours,
          breakHours: 0,
          status: sub.status,
          submittedAt: sub.submittedAt ?? "",
        });
      }
    })
  );

  const result = await syncAll(timeEntryRows, expenseRows, timesheetRows);

  lastSync = {
    timestamp: result.timestamp,
    success: result.success,
    message: result.message,
    timeEntries: result.timeEntries,
    expenses: result.expenses,
    timesheets: result.timesheets,
  };

  return NextResponse.json(result, { status: result.success || !result.configured ? 200 : 207 });
}
