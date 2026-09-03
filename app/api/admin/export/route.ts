import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/api-auth";
import { store } from "@/lib/data";
import { weekStartDateFor } from "@/lib/domain/weekly-submissions";
import { computeWorkedMs, msToHours, startOfWeek } from "@/lib/domain/worked-hours";
import { addDays } from "date-fns";

function cell(value: unknown): string {
  const str = String(value ?? "");
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function toCSV(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(cell).join(","),
    ...rows.map((r) => r.map(cell).join(",")),
  ].join("\n");
}

export async function GET(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;
  const actor = { id: auth.session.userId, role: auth.session.role };

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  // ── Time Entries ───────────────────────────────────────────────────────────
  if (type === "time-entries") {
    const [entries, projects, tasks, trainers] = await Promise.all([
      store.listAllTaskEntries(),
      store.listProjects(),
      store.listAllTasks(),
      store.listTrainers(),
    ]);

    const projectsById = new Map(projects.map((p) => [p.id, p]));
    const tasksById = new Map(tasks.map((t) => [t.id, t]));
    const trainersById = new Map(trainers.map((t) => [t.id, t]));

    // Per-trainer weekly submission statuses
    const submissionsByTrainer = new Map<string, Awaited<ReturnType<typeof store.listWeeklySubmissionsForTrainer>>>();
    await Promise.all(
      trainers.map(async (t) => {
        const subs = await store.listWeeklySubmissionsForTrainer(t.id, actor);
        submissionsByTrainer.set(t.id, subs);
      })
    );

    const headers = [
      "Trainer", "Project", "Task", "Date", "Hours",
      "Location", "Office", "Note", "Billable", "Week Status", "Week Start",
    ];

    const rows = entries.map((e) => {
      const project = projectsById.get(e.projectId);
      const task = tasksById.get(e.taskId);
      const trainer = trainersById.get(e.trainerId);
      const weekStart = weekStartDateFor(e.date);
      const subs = submissionsByTrainer.get(e.trainerId) ?? [];
      const sub = subs.find((s) => s.weekStartDate === weekStart);
      return [
        trainer?.name ?? e.trainerId,
        project?.name ?? e.projectId,
        task?.title ?? e.taskId,
        e.date,
        e.hours,
        e.location ?? "",
        e.office,
        e.note,
        task?.billable ? "Yes" : "No",
        sub?.status ?? "draft",
        weekStart,
      ];
    });

    rows.sort((a, b) => String(b[3]).localeCompare(String(a[3])));

    return new NextResponse(toCSV(headers, rows), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="time-entries-${today()}.csv"`,
      },
    });
  }

  // ── Expenses ───────────────────────────────────────────────────────────────
  if (type === "expenses") {
    const [trainers, projects] = await Promise.all([
      store.listTrainers(),
      store.listProjects(),
    ]);

    const projectsById = new Map(projects.map((p) => [p.id, p]));

    const allExpenses = (
      await Promise.all(
        trainers.map(async (t) => {
          const expenses = await store.listExpensesForTrainer(t.id, actor);
          return expenses.map((e) => ({ ...e, trainerName: t.name }));
        })
      )
    ).flat();

    const headers = [
      "Trainer", "Project", "Date", "Category", "Amount",
      "Description", "Status", "Rejection Reason", "Submitted At",
    ];

    const rows = allExpenses.map((e) => [
      e.trainerName,
      e.projectId ? (projectsById.get(e.projectId)?.name ?? e.projectId) : "",
      e.date,
      e.category,
      e.amount.toFixed(2),
      e.description,
      e.status,
      e.rejectionReason ?? "",
      e.createdAt.split("T")[0],
    ]);

    rows.sort((a, b) => String(b[2]).localeCompare(String(a[2])));

    return new NextResponse(toCSV(headers, rows), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="expenses-${today()}.csv"`,
      },
    });
  }

  // ── Timesheets ─────────────────────────────────────────────────────────────
  if (type === "timesheets") {
    const trainers = await store.listTrainers();

    const rows: unknown[][] = [];
    await Promise.all(
      trainers.map(async (trainer) => {
        const [submissions, events] = await Promise.all([
          store.listTimesheetSubmissionsForTrainer(trainer.id, actor),
          store.listTimeClockEvents(trainer.id),
        ]);

        for (const sub of submissions) {
          const weekStart = new Date(sub.weekStartDate);
          const weekEnd = addDays(weekStart, 5);

          const totalMs = computeWorkedMs(events, weekStart, weekEnd);
          const totalHours = msToHours(totalMs);

          rows.push([
            trainer.name,
            sub.weekStartDate,
            totalHours,
            sub.status,
            sub.submittedAt ? sub.submittedAt.split("T")[0] : "",
            sub.reviewedAt ? sub.reviewedAt.split("T")[0] : "",
          ]);
        }
      })
    );

    rows.sort((a, b) => String(b[1]).localeCompare(String(a[1])));

    const headers = [
      "Trainer", "Week Start", "Total Hours",
      "Status", "Submitted At", "Reviewed At",
    ];

    return new NextResponse(toCSV(headers, rows), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="timesheets-${today()}.csv"`,
      },
    });
  }

  return NextResponse.json(
    { error: "type must be one of: time-entries, expenses, timesheets" },
    { status: 400 }
  );
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}
