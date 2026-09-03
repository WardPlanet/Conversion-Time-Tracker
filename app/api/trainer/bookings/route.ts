import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET() {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const [bookings, projects] = await Promise.all([
    store.listBookingsForTrainer(auth.session.userId),
    store.listProjects(),
  ]);

  const activeProjects = projects.filter((p) => p.status === "active");
  const officesByProject = await Promise.all(
    activeProjects.map((p) => store.listOfficesForProject(p.id))
  );
  const offices = officesByProject.flat();

  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const officesById = new Map(offices.map((o) => [o.id, o]));
  const enrichedBookings = bookings.map((booking) => ({
    ...booking,
    project: projectsById.get(booking.projectId) ?? null,
    office: officesById.get(booking.officeId) ?? null,
  }));

  return NextResponse.json({ bookings: enrichedBookings });
}
