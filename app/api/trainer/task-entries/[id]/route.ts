import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const office = typeof body?.office === "string" ? body.office : "";
  const taskId = typeof body?.taskId === "string" ? body.taskId : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const hours = typeof body?.hours === "number" ? body.hours : NaN;

  if (!projectId || !office || !taskId || !note || !(hours > 0)) {
    return NextResponse.json(
      {
        error:
          "projectId, office, taskId, note, and a positive hours value are required.",
      },
      { status: 400 }
    );
  }

  try {
    const entry = await store.updateTaskEntry(
      params.id,
      { projectId, office, taskId, note, hours },
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ entry });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to update task entry.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  try {
    await store.deleteTaskEntry(params.id, {
      id: auth.session.userId,
      role: auth.session.role,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to delete task entry.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
