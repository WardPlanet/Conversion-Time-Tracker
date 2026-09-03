import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import { enrichExpenses } from "@/lib/domain/expenses";
import type { ExpenseCategory } from "@/lib/types";

export async function GET() {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const trainerId = auth.session.userId;
  const actor = { id: trainerId, role: auth.session.role };

  const [expenses, allProjects] = await Promise.all([
    store.listExpensesForTrainer(trainerId, actor),
    store.listProjects(),
  ]);

  // Only projects a trainer could plausibly be submitting a fresh expense
  // against — mirrors the active/on_hold filter used elsewhere for new
  // trainer-facing form dropdowns.
  const projects = allProjects.filter(
    (p) => p.status === "active" || p.status === "on_hold"
  );
  const trainer = await store.getUserById(trainerId);

  return NextResponse.json({
    expenses: enrichExpenses(expenses, trainer ? [trainer] : [], allProjects),
    projects,
  });
}

export async function POST(request: Request) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const projectId =
    typeof body?.projectId === "string" && body.projectId
      ? body.projectId
      : undefined;
  const date = typeof body?.date === "string" ? body.date : "";
  const category: ExpenseCategory =
    typeof body?.category === "string" ? body.category : "";
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const description =
    typeof body?.description === "string" ? body.description : "";

  try {
    const expense = await store.createExpense(
      { projectId, date, category, amount, description },
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ expense }, { status: 201 });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to submit expense.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
