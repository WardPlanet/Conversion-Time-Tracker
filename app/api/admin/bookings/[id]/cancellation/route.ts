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
  const actor = { id: auth.session.userId, role: auth.session.role };

  try {
    if (body?.action === "approve") {
      const booking = await store.approveBookingCancellation(
        params.id,
        actor
      );
      return NextResponse.json({ booking });
    }

    if (body?.action === "deny") {
      const booking = await store.denyBookingCancellation(params.id, actor);
      return NextResponse.json({ booking });
    }

    return NextResponse.json(
      { error: "action must be 'approve' or 'deny'." },
      { status: 400 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to resolve cancellation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
