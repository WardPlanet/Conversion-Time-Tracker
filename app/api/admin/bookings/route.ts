import { NextResponse } from "next/server";
import { store, isBookingConflictError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import type { BillableStatus, BookingLocation } from "@/lib/types";

const VALID_LOCATIONS: BookingLocation[] = ["on_site", "remote"];
const VALID_BILLABLE: BillableStatus[] = ["billable", "non_billable"];

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const [bookings, projects, trainers] = await Promise.all([
    store.listAllBookings(),
    store.listProjects(),
    store.listTrainers(),
  ]);

  const activeProjects = projects.filter((p) => p.status === "active");
  const officesByProject = await Promise.all(
    activeProjects.map((p) => store.listOfficesForProject(p.id))
  );
  // Flattened across every active project — the client filters by whichever
  // project is currently selected in the Book Trainer form (cascading dropdown).
  const offices = officesByProject.flat();

  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const trainersById = new Map(trainers.map((t) => [t.id, t]));
  const officesById = new Map(offices.map((o) => [o.id, o]));

  const enrichedBookings = bookings.map((b) => ({
    ...b,
    project: projectsById.get(b.projectId) ?? null,
    trainer: trainersById.get(b.trainerId) ?? null,
    office: officesById.get(b.officeId) ?? null,
  }));

  return NextResponse.json({
    bookings: enrichedBookings,
    trainers,
    projects,
    offices,
  });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const trainerId = typeof body?.trainerId === "string" ? body.trainerId : "";
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const officeId = typeof body?.officeId === "string" ? body.officeId : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const startTime = typeof body?.startTime === "string" ? body.startTime : "";
  const endTime = typeof body?.endTime === "string" ? body.endTime : "";
  const location = body?.location;
  const billable = body?.billable;
  const notes =
    typeof body?.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : undefined;

  if (
    !trainerId ||
    !projectId ||
    !officeId ||
    !title ||
    !startTime ||
    !endTime ||
    !VALID_LOCATIONS.includes(location) ||
    !VALID_BILLABLE.includes(billable)
  ) {
    return NextResponse.json(
      {
        error:
          "trainerId, projectId, officeId, title, startTime, endTime, location, and billable are required.",
      },
      { status: 400 }
    );
  }

  try {
    const booking = await store.createBooking(
      {
        trainerId,
        projectId,
        officeId,
        title,
        startTime,
        endTime,
        location,
        billable,
        notes,
      },
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    if (isBookingConflictError(err)) {
      return NextResponse.json(
        { error: err.message, conflict: err.conflictingBooking },
        { status: 409 }
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to create booking.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
