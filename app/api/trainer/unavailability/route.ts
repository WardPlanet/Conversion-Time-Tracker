import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import type { UnavailabilityType } from "@/lib/types";

export async function GET() {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const trainerId = auth.session.userId;
  const blocks = await store.listUnavailabilityBlocksForTrainer(trainerId, {
    id: trainerId,
    role: auth.session.role,
  });

  return NextResponse.json({ blocks });
}

export async function POST(request: Request) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const type: UnavailabilityType =
    typeof body?.type === "string" ? body.type : "one_time";
  const startDate = typeof body?.startDate === "string" ? body.startDate : "";
  const endDate =
    typeof body?.endDate === "string" && body.endDate
      ? body.endDate
      : undefined;
  const startTime =
    typeof body?.startTime === "string" && body.startTime
      ? body.startTime
      : undefined;
  const endTime =
    typeof body?.endTime === "string" && body.endTime
      ? body.endTime
      : undefined;
  const recurringDayOfWeek =
    typeof body?.recurringDayOfWeek === "number"
      ? body.recurringDayOfWeek
      : undefined;
  const reason =
    typeof body?.reason === "string" && body.reason ? body.reason : undefined;

  try {
    const block = await store.createUnavailabilityBlock(
      { type, startDate, endDate, startTime, endTime, recurringDayOfWeek, reason },
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ block }, { status: 201 });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error
        ? err.message
        : "Failed to create unavailability block.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
