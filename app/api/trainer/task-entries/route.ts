import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET() {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const trainerId = auth.session.userId;
  const [entries, allProjects, tasks, bookings] = await Promise.all([
    store.listTaskEntriesForTrainer(trainerId),
    store.listProjects(),
    store.listTasksForTrainer(trainerId),
    store.listBookingsForTrainer(trainerId),
  ]);

  const projects = allProjects.filter(
    (p) => p.status === "active" || p.status === "on_hold"
  );
  const officesByProject = await Promise.all(
    projects.map((p) => store.listOfficesForProject(p.id))
  );
  // Flattened across every active project — the client filters by whichever
  // project is currently selected in the form (cascading dropdown).
  const offices = officesByProject.flat().filter((o) => o.active);

  const projectsById = new Map(allProjects.map((p) => [p.id, p]));
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const enrichedEntries = entries
    .map((e) => ({
      ...e,
      project: projectsById.get(e.projectId) ?? null,
      task: tasksById.get(e.taskId) ?? null,
    }))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
    );

  return NextResponse.json({
    entries: enrichedEntries,
    projects,
    offices,
    tasks,
    bookings,
  });
}

export async function POST(request: Request) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date : "";
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const office = typeof body?.office === "string" ? body.office : "";
  const taskId = typeof body?.taskId === "string" ? body.taskId : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const hours = typeof body?.hours === "number" ? body.hours : NaN;
  const location =
    typeof body?.location === "string" && body.location.trim()
      ? body.location.trim()
      : undefined;
  const bookingId =
    typeof body?.bookingId === "string" && body.bookingId
      ? body.bookingId
      : undefined;
  const markComplete = body?.markComplete === true;

  if (!date || !projectId || !office || !taskId || !note || !(hours > 0)) {
    return NextResponse.json(
      {
        error:
          "date, projectId, office, taskId, note, and a positive hours value are required.",
      },
      { status: 400 }
    );
  }

  const project = await store.getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 400 });
  }
  if (project.productLine !== "internal_admin" && !location) {
    return NextResponse.json(
      { error: "A location is required for customer project entries." },
      { status: 400 }
    );
  }

  const actor = { id: auth.session.userId, role: auth.session.role };

  try {
    const entry = await store.createTaskEntry(
      { date, projectId, office, taskId, note, hours, location, bookingId },
      actor
    );

    if (markComplete) {
      await store.updateTaskStatus(taskId, "completed", actor);
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to log task entry.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
