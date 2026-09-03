import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;
  const actor = { id: auth.session.userId, role: auth.session.role };

  const body = await request.json().catch(() => null);

  try {
    if (body?.action === "approve") {
      const correction = await store.approveClockCorrection(params.id, actor);
      return NextResponse.json({ correction });
    }

    if (body?.action === "deny") {
      const adminNote =
        typeof body?.adminNote === "string" ? body.adminNote : undefined;
      const correction = await store.denyClockCorrection(
        params.id,
        adminNote,
        actor
      );
      return NextResponse.json({ correction });
    }

    return NextResponse.json(
      { error: "action must be 'approve' or 'deny'." },
      { status: 400 }
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to update correction request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
