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
  const action: "approve" | "reject" = body.action;
  const reason: string | undefined = body.reason;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'." }, { status: 400 });
  }

  const submission = await store.reviewWeeklySubmissionAsPartner(
    params.id,
    action,
    { id: auth.session.userId, role: auth.session.role },
    reason
  );

  return NextResponse.json({ submission });
}
