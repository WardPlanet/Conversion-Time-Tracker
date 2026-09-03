import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import { enrichWeeklySubmissions } from "@/lib/domain/weekly-submissions";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const actor = { id: auth.session.userId, role: auth.session.role };

  const [submissions, trainers, taskEntries] = await Promise.all([
    store.listPendingWeeklySubmissions(actor),
    store.listTrainers(),
    store.listAllTaskEntries(),
  ]);

  return NextResponse.json({
    submissions: enrichWeeklySubmissions(submissions, trainers, taskEntries),
  });
}
