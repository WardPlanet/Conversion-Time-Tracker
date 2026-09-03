import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import { enrichTimesheetSubmissions } from "@/lib/domain/timesheet-submissions";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const actor = { id: auth.session.userId, role: auth.session.role };

  const [submissions, trainers, events] = await Promise.all([
    store.listPendingTimesheetSubmissions(actor),
    store.listTrainers(),
    store.listAllTimeClockEvents(),
  ]);

  return NextResponse.json({
    submissions: enrichTimesheetSubmissions(submissions, trainers, events),
  });
}
