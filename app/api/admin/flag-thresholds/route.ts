import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const thresholds = await store.getFlagThresholds();
  return NextResponse.json({ thresholds });
}

export async function PATCH(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const unsubmittedTaskTrackerDays = Number(body?.unsubmittedTaskTrackerDays);
  const pendingBookingUnansweredHours = Number(
    body?.pendingBookingUnansweredHours
  );
  const inactiveTrainerDays = Number(body?.inactiveTrainerDays);

  if (
    !Number.isFinite(unsubmittedTaskTrackerDays) ||
    !Number.isFinite(pendingBookingUnansweredHours) ||
    !Number.isFinite(inactiveTrainerDays)
  ) {
    return NextResponse.json(
      {
        error:
          "unsubmittedTaskTrackerDays, pendingBookingUnansweredHours, and inactiveTrainerDays must all be numbers.",
      },
      { status: 400 }
    );
  }

  try {
    const thresholds = await store.updateFlagThresholds(
      {
        unsubmittedTaskTrackerDays,
        pendingBookingUnansweredHours,
        inactiveTrainerDays,
      },
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ thresholds });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update thresholds.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
