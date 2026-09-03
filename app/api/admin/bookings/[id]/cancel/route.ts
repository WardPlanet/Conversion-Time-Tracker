import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

/**
 * Admin-only direct cancellation — immediate, no approval step, and works
 * regardless of the booking's current status. Distinct from the
 * trainer-initiated request/approve/deny flow at `../cancellation`.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason : undefined;
  const actor = { id: auth.session.userId, role: auth.session.role };

  try {
    const booking = await store.adminCancelBooking(params.id, actor, reason);
    return NextResponse.json({ booking });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to cancel booking.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
