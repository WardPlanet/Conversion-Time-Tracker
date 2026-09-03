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
  if (body?.status !== "dismissed") {
    return NextResponse.json(
      { error: "status must be 'dismissed'." },
      { status: 400 }
    );
  }

  const note =
    typeof body?.note === "string" && body.note.trim()
      ? body.note.trim()
      : undefined;

  try {
    const flag = await store.dismissFlag(
      params.id,
      { note },
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ flag });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to dismiss flag.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
