import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import type { BookingStatus } from "@/lib/types";

// "pending" is only reachable as an undo of a recent accept/reject — the
// store itself enforces that constraint, this route just admits the value.
const TRAINER_ALLOWED_STATUSES: BookingStatus[] = [
  "accepted",
  "rejected",
  "pending",
];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const status = body?.status;
  const reason = typeof body?.reason === "string" ? body.reason : undefined;

  // Only `status`/`reason` are ever read from the request body here — a
  // trainer has no route through which `billable` can reach the data layer.
  if (!TRAINER_ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "status must be 'accepted', 'rejected', or 'pending'." },
      { status: 400 }
    );
  }

  try {
    const booking = await store.updateBookingStatus(
      params.id,
      status,
      { id: auth.session.userId, role: auth.session.role },
      reason
    );
    return NextResponse.json({ booking });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to update booking.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
