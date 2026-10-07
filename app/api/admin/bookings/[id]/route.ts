import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const [booking, trainers, projects] = await Promise.all([
    store.getBooking(params.id),
    store.listTrainers(),
    store.listProjects(),
  ]);

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const trainer = trainers.find((t) => t.id === booking.trainerId) ?? null;
  const project = projects.find((p) => p.id === booking.projectId) ?? null;

  return NextResponse.json({ booking, trainer, project });
}
