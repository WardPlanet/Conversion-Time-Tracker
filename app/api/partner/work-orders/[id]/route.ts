import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("partner_admin");
  if (!auth.session) return auth.response;

  const body = await request.json();
  const action: "approve" | "deny" = body.action;
  const reason: string | undefined = body.reason;

  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "action must be 'approve' or 'deny'." }, { status: 400 });
  }

  try {
    const booking = await store.respondToWorkOrder(
      params.id,
      action,
      { id: auth.session.userId, role: auth.session.role },
      reason
    );
    return NextResponse.json({ booking });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update work order.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
