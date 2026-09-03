import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import { enrichExpenses } from "@/lib/domain/expenses";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const actor = { id: auth.session.userId, role: auth.session.role };

  const [expenses, trainers, projects] = await Promise.all([
    store.listPendingExpenses(actor),
    store.listTrainers(),
    store.listProjects(),
  ]);

  return NextResponse.json({
    expenses: enrichExpenses(expenses, trainers, projects),
  });
}
