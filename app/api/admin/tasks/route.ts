import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId query param is required." },
      { status: 400 }
    );
  }

  const allTasks = await store.listAllTasks();
  const tasks = allTasks.filter((t) => t.projectId === projectId);
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const trainerId =
    typeof body?.trainerId === "string" ? body.trainerId : "";
  const billable = typeof body?.billable === "boolean" ? body.billable : null;

  if (!projectId || !title || !trainerId || billable === null) {
    return NextResponse.json(
      { error: "projectId, title, trainerId, and billable are required." },
      { status: 400 }
    );
  }

  try {
    const task = await store.createTask(
      { projectId, title, billable, trainerId },
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
