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
  const location = body?.location;
  const billable = body?.billable;
  const notes =
    typeof body?.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : undefined;
  const groupId =
    typeof body?.groupId === "string" ? body.groupId : undefined;
  const allDay = body?.allDay === true;

  // trainingDates: array of "YYYY-MM-DD" strings for training days
  const trainingDates: string[] = Array.isArray(body?.trainingDates)
    ? body.trainingDates.filter((d: unknown) => typeof d === "string")
    : [];
  // travelBeforeDate / travelAfterDate: single "YYYY-MM-DD" strings
  const travelBeforeDate =
    typeof body?.travelBeforeDate === "string" ? body.travelBeforeDate : null;
  const travelAfterDate =
    typeof body?.travelAfterDate === "string" ? body.travelAfterDate : null;

  // Time strings (HH:mm) used when allDay is false
  const startTimePart =
    typeof body?.startTime === "string" ? body.startTime : "09:00";
  const endTimePart =
    typeof body?.endTime === "string" ? body.endTime : "17:00";

  if (
    !trainerId ||
    !projectId ||
    !officeId ||
    !title ||
    trainingDates.length === 0 ||
    !VALID_LOCATIONS.includes(location) ||
    !VALID_BILLABLE.includes(billable)
  ) {
    return NextResponse.json(
      {
        error:
          "trainerId, projectId, officeId, title, trainingDates, location, and billable are required.",
      },
      { status: 400 }
    );
  }

  const actor = { id: auth.session.userId, role: auth.session.role };
  const createdBookings = [];

  // Helper: build ISO times for a date string
  function makeTrainingTimes(date: string) {
    if (allDay) {
      return {
        startTime: `${date}T12:00:00.000Z`,
        endTime: `${date}T23:59:00.000Z`,
      };
    }
    return {
      startTime: new Date(`${date}T${startTimePart}`).toISOString(),
      endTime: new Date(`${date}T${endTimePart}`).toISOString(),
    };
  }

  function makeTravelTimes(date: string) {
    return {
      startTime: `${date}T12:00:00.000Z`,
      endTime: `${date}T23:59:00.000Z`,
    };
  }

  try {
    // Create training day bookings
    for (const date of trainingDates) {
      const { startTime, endTime } = makeTrainingTimes(date);
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
          allDay: allDay || false,
          bookingType: "training",
          groupId,
        },
        actor
      );
      createdBookings.push(booking);
    }

    // Create travel day bookings (no conflict check, no trainer notification)
    const travelTitle = `${title} — Travel`;
    for (const date of [travelBeforeDate, travelAfterDate]) {
      if (!date) continue;
      const { startTime, endTime } = makeTravelTimes(date);
      const booking = await store.createBooking(
        {
          trainerId,
          projectId,
          officeId,
          title: travelTitle,
          startTime,
          endTime,
          location,
          billable,
          allDay: true,
          bookingType: "travel",
          groupId,
        },
        actor
      );
      createdBookings.push(booking);
    }

    return NextResponse.json({ bookings: createdBookings }, { status: 201 });
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
