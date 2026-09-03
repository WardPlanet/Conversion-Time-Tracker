import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import type { ExpenseCategory } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    const expense = await store.updateExpense(
      params.id,
      { projectId, date, category, amount, description },
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ expense });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to update expense.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
