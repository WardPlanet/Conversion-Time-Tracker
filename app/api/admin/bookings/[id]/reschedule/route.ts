import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import type { BillableStatus, BookingLocation } from "@/lib/types";

const VALID_LOCATIONS: BookingLocation[] = ["on_site", "remote"];
const VALID_BILLABLE: BillableStatus[] = ["billable", "non_billable"];

/**
 * Admin-only. Reschedules a booking's date/time/location (and billable
 * status, if given), resets its status to "pending" so the trainer
 * re-confirms through the same accept/reject flow as a fresh booking, and
 * notifies them — including the reason, if one was given.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const startTime = typeof body?.startTime === "string" ? body.startTime : "";
  const endTime = typeof body?.endTime === "string" ? body.endTime : "";
  const location = body?.location;
  const billable = body?.billable;
  const reason = typeof body?.reason === "string" ? body.reason : undefined;

  if (!startTime || !endTime || !VALID_LOCATIONS.includes(location)) {
    return NextResponse.json(
      { error: "startTime, endTime, and a valid location are required." },
      { status: 400 }
    );
  }
  if (billable !== undefined && !VALID_BILLABLE.includes(billable)) {
    return NextResponse.json(
      { error: "billable must be 'billable' or 'non_billable'." },
      { status: 400 }
    );
  }

  const actor = { id: auth.session.userId, role: auth.session.role };

  try {
    const booking = await store.adminRescheduleBooking(
      params.id,
      { startTime, endTime, location },
      actor,
      billable,
      reason
    );
    return NextResponse.json({ booking });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reschedule booking.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
