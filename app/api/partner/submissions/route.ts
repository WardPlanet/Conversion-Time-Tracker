import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET() {
  const auth = await requireRole("partner_admin");
  if (!auth.session) return auth.response;

  const actor = { id: auth.session.userId, role: auth.session.role };

  const [weeklySubmissions, timesheetSubmissions, expenses] = await Promise.all([
    store.listSubmittedWeeklySubmissionsForPartner(actor),
    store.listSubmittedTimesheetSubmissionsForPartner(actor),
    store.listPendingExpensesForPartner(actor),
  ]);

  return NextResponse.json({ weeklySubmissions, timesheetSubmissions, expenses });
}
