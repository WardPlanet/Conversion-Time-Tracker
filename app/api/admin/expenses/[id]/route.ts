import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const actor = { id: auth.session.userId, role: auth.session.role };

  try {
    if (body?.status === "approved") {
      const expense = await store.approveExpense(params.id, actor);
      return NextResponse.json({ expense });
    }

    if (body?.status === "rejected") {
      const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
      if (!reason) {
        return NextResponse.json(
          { error: "A rejection reason is required." },
          { status: 400 }
        );
      }
      const expense = await store.rejectExpense(params.id, reason, actor);
      return NextResponse.json({ expense });
    }

    return NextResponse.json(
      { error: "status must be 'approved' or 'rejected'." },
      { status: 400 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update expense.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
