import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import { enrichFlags } from "@/lib/domain/flags";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const actor = { id: auth.session.userId, role: auth.session.role };

  const [flags, trainers, bookings, projects] = await Promise.all([
    store.listActiveFlags(actor),
    store.listTrainers(),
    store.listAllBookings(),
    store.listProjects(),
  ]);

  return NextResponse.json({
    flags: enrichFlags(flags, trainers, bookings, projects),
  });
}

/** Bulk "Dismiss all" — the Dashboard's compact Flags section acts on the whole collection, unlike the single-flag PATCH at /api/admin/flags/[id]. */
export async function PATCH(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  if (body?.status !== "dismissed") {
    return NextResponse.json(
      { error: "status must be 'dismissed'." },
      { status: 400 }
    );
  }

  const flags = await store.dismissAllFlags({
    id: auth.session.userId,
    role: auth.session.role,
  });
  return NextResponse.json({ flags });
}
