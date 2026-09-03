import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import type { TaskStatus } from "@/lib/types";

const VALID_STATUSES: TaskStatus[] = [
  "not_started",
  "in_progress",
  "completed",
];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const status = body?.status;

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "status must be not_started, in_progress, or completed." },
      { status: 400 }
    );
  }

  try {
    const task = await store.updateTaskStatus(params.id, status, {
      id: auth.session.userId,
      role: auth.session.role,
    });
    return NextResponse.json({ task });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to update task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
