import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import { enrichManualSessionRequests } from "@/lib/domain/manual-sessions";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;
  const actor = { id: auth.session.userId, role: auth.session.role };

  const [requests, trainers] = await Promise.all([
    store.listPendingManualSessionRequests(actor),
    store.listTrainers(),
  ]);

  return NextResponse.json({
    requests: enrichManualSessionRequests(requests, trainers),
  });
}
