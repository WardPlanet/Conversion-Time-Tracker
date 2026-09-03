import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET() {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const trainerId = auth.session.userId;
  const [allProjects, tasks, bookings] = await Promise.all([
    store.listProjects(),
    store.listTasksForTrainer(trainerId),
    store.listBookingsForTrainer(trainerId),
  ]);

  // A trainer is "assigned" to a project once they have a task or a booking
  // tied to it — there is no separate project-assignment record.
  const assignedProjectIds = new Set([
    ...tasks.map((t) => t.projectId),
    ...bookings.map((b) => b.projectId),
  ]);
  // Every status included — the client groups Active/On Hold into the main
  // sections and completed/deactivated into the Archive.
  const projects = allProjects.filter((p) => assignedProjectIds.has(p.id));

  return NextResponse.json({ projects, tasks });
}
