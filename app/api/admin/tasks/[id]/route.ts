import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  try {
    await store.deleteTask(params.id, {
      id: auth.session.userId,
      role: auth.session.role,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
