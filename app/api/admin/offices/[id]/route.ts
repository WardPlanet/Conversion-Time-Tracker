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
  if (typeof body?.active !== "boolean") {
    return NextResponse.json(
      { error: "active (boolean) is required." },
      { status: 400 }
    );
  }

  try {
    const office = await store.setOfficeActive(params.id, body.active, {
      id: auth.session.userId,
      role: auth.session.role,
    });
    return NextResponse.json({ office });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update office.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
