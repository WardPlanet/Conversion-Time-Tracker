import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET() {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const trainerId = auth.session.userId;
  const submissions = await store.listWeeklySubmissionsForTrainer(trainerId, {
    id: trainerId,
    role: auth.session.role,
  });

  return NextResponse.json({ submissions });
}

export async function POST(request: Request) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const weekStartDate =
    typeof body?.weekStartDate === "string" ? body.weekStartDate : "";

  if (!weekStartDate) {
    return NextResponse.json(
      { error: "weekStartDate is required." },
      { status: 400 }
    );
  }

  try {
    const submission = await store.submitWeek(weekStartDate, {
      id: auth.session.userId,
      role: auth.session.role,
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit week.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
