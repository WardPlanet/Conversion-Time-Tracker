import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import { enrichClockCorrectionRequests } from "@/lib/domain/clock-corrections";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;
  const actor = { id: auth.session.userId, role: auth.session.role };

  const [requests, trainers, allEvents] = await Promise.all([
    store.listPendingClockCorrectionRequests(actor),
    store.listTrainers(),
    store.listAllTimeClockEvents(),
  ]);

  return NextResponse.json({
    requests: enrichClockCorrectionRequests(requests, trainers, allEvents),
  });
}
