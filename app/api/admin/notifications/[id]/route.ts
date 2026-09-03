import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  try {
    const notification = await store.markNotificationRead(params.id, {
      id: auth.session.userId,
      role: auth.session.role,
    });
    return NextResponse.json({ notification });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update notification.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
