import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET() {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;
  const actor = { id: auth.session.userId, role: auth.session.role };

  const requests = await store.listManualSessionRequestsForTrainer(
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
  const date = typeof body?.date === "string" ? body.date : "";
  const clockIn = typeof body?.clockIn === "string" ? body.clockIn : "";
  const clockOut = typeof body?.clockOut === "string" ? body.clockOut : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const breaks = Array.isArray(body?.breaks)
    ? body.breaks
        .filter(
          (b: unknown): b is { start: string; end: string } =>
            typeof (b as { start?: unknown })?.start === "string" &&
            typeof (b as { end?: unknown })?.end === "string"
        )
        .map((b: { start: string; end: string }) => ({
          start: b.start,
          end: b.end,
        }))
    : [];

  if (!date || !clockIn || !clockOut || !reason.trim()) {
    return NextResponse.json(
      { error: "date, clockIn, clockOut, and reason are required." },
      { status: 400 }
    );
  }

  try {
    const sessionRequest = await store.requestManualSession(
      { date, clockIn, clockOut, breaks, reason },
      actor
    );
    return NextResponse.json({ request: sessionRequest }, { status: 201 });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error
        ? err.message
        : "Failed to submit manual session request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
