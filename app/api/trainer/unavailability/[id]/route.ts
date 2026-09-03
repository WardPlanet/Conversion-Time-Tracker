import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  try {
    await store.deleteUnavailabilityBlock(params.id, {
      id: auth.session.userId,
      role: auth.session.role,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error
        ? err.message
        : "Failed to delete unavailability block.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
