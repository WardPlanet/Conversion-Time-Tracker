import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!reason) {
    return NextResponse.json(
      { error: "A cancellation reason is required." },
      { status: 400 }
    );
  }

  try {
    const booking = await store.requestBookingCancellation(
      params.id,
      reason,
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ booking });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to request cancellation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
