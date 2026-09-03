import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET() {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;
  const actor = { id: auth.session.userId, role: auth.session.role };

  const requests = await store.listClockCorrectionRequestsForTrainer(
    actor.id,
    actor
  );
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;
  const actor = { id: auth.session.userId, role: auth.session.role };

  const body = await request.json().catch(() => null);
  const eventId = typeof body?.eventId === "string" ? body.eventId : "";
  const requestedTimestamp =
    typeof body?.requestedTimestamp === "string"
      ? body.requestedTimestamp
      : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";

  if (!eventId || !requestedTimestamp || !reason.trim()) {
    return NextResponse.json(
      { error: "eventId, requestedTimestamp, and reason are required." },
      { status: 400 }
    );
  }

  try {
    const correctionRequest = await store.requestClockCorrection(
      eventId,
      requestedTimestamp,
      reason,
      actor
    );
    return NextResponse.json({ request: correctionRequest }, { status: 201 });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error
        ? err.message
        : "Failed to submit correction request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
