import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const hasActive = typeof body?.active === "boolean";
  const hasCompleted = typeof body?.completed === "boolean";

  if (!hasActive && !hasCompleted) {
    return NextResponse.json(
      { error: "active or completed (boolean) is required." },
      { status: 400 }
    );
  }

  const actor = { id: auth.session.userId, role: auth.session.role };

  try {
    let office;
    if (hasCompleted) {
      office = await store.setOfficeCompleted(params.id, body.completed, actor);
    }
    if (hasActive) {
      office = await store.setOfficeActive(params.id, body.active, actor);
    }
    return NextResponse.json({ office });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update office.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
