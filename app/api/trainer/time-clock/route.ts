import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import { computeClockStatus } from "@/lib/domain/clock-status";
import type { TimeClockEventType } from "@/lib/types";

const VALID_EVENT_TYPES: TimeClockEventType[] = [
  "clock_in",
  "clock_out",
  "break_start",
  "break_end",
];

export async function GET() {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const events = await store.listTimeClockEvents(auth.session.userId);
  const status = computeClockStatus(events);
  const sortedEvents = [...events].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp)
  );

  return NextResponse.json({ status, events: sortedEvents });
}

export async function POST(request: Request) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const type = body?.type;

  if (!VALID_EVENT_TYPES.includes(type)) {
    return NextResponse.json(
      {
        error:
          "type must be one of clock_in, clock_out, break_start, break_end.",
      },
      { status: 400 }
    );
  }

  try {
    const event = await store.addTimeClockEvent(auth.session.userId, type, {
      id: auth.session.userId,
      role: auth.session.role,
    });
    const events = await store.listTimeClockEvents(auth.session.userId);
    return NextResponse.json({
      event,
      status: computeClockStatus(events),
    });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to log time clock event.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
