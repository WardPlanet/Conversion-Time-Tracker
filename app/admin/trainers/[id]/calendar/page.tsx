import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { store } from "@/lib/data";
import {
  BillableTag,
  BookingStatusTag,
  LocationTag,
  OfficeTag,
  ProjectDot,
} from "@/components/trainer/badges";
import { formatDateRange } from "@/lib/format";
import { formatUnavailabilityLabel } from "@/lib/domain/unavailability";
import type { Booking, Office, Project } from "@/lib/types";

function BookingCard({
  booking,
  project,
  office,
}: {
  booking: Booking;
  project: Project | null;
  office: Office | null;
}) {
  return (
    <li className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {project && <ProjectDot color={project.color} />}
          <span className="font-medium">{booking.title}</span>
        </div>
        <BookingStatusTag status={booking.status} />
      </div>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        {project?.name ?? "Unknown project"}
      </p>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        {formatDateRange(booking.startTime, booking.endTime)}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <LocationTag location={booking.location} />
        {office && <OfficeTag office={office.name} />}
        <BillableTag billable={booking.billable} />
      </div>
      {booking.cancellationReason && (
        <p className="mt-2 text-sm text-brand-darkBlue/70">
          “{booking.cancellationReason}”
        </p>
      )}
    </li>
  );
}

export default async function TrainerCalendarTab({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) notFound();
  const actor = { id: session.userId, role: session.role };

  const [bookings, projects, unavailabilityBlocks] = await Promise.all([
    store.listBookingsForTrainer(params.id),
    store.listProjects(),
    store.listUnavailabilityBlocksForTrainer(params.id, actor),
  ]);

  const bookedProjectIds = [...new Set(bookings.map((b) => b.projectId))];
  const officesByProject = await Promise.all(
    bookedProjectIds.map((id) => store.listOfficesForProject(id))
  );
  const offices = officesByProject.flat();

  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const officesById = new Map(offices.map((o) => [o.id, o]));
  const now = new Date();

  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings
    .filter(
      (b) =>
        (b.status === "accepted" || b.status === "cancellation_requested") &&
        new Date(b.startTime) >= now
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const past = bookings
    .filter((b) => !pending.includes(b) && !upcoming.includes(b))
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  return (
    <div>
      <h2 className="text-lg font-medium">Calendar</h2>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        Read-only — booking creation and edits happen in Scheduling.
      </p>

      <section className="mt-6">
        <h3 className="text-sm font-medium text-brand-darkBlue/80">
          Unavailability ({unavailabilityBlocks.length})
        </h3>
        <p className="mt-1 text-xs text-brand-darkBlue/50">
          Informational only — doesn&apos;t block scheduling.
        </p>
        {unavailabilityBlocks.length === 0 ? (
          <p className="mt-2 text-sm text-brand-darkBlue/60">
            No unavailability blocks.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {unavailabilityBlocks.map((block) => (
              <li
                key={block.id}
                className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4"
              >
                <p className="text-sm font-medium text-brand-darkBlue">
                  {formatUnavailabilityLabel(block)}
                </p>
                {block.reason && (
                  <p className="mt-1 text-sm text-brand-darkBlue/60">
                    {block.reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-medium text-brand-darkBlue/80">
          Pending ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-brand-darkBlue/60">No pending bookings.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {pending.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                project={projectsById.get(b.projectId) ?? null}
                office={officesById.get(b.officeId) ?? null}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-medium text-brand-darkBlue/80">
          Upcoming ({upcoming.length})
        </h3>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-brand-darkBlue/60">No upcoming bookings.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {upcoming.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                project={projectsById.get(b.projectId) ?? null}
                office={officesById.get(b.officeId) ?? null}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-medium text-brand-darkBlue/80">
          Past ({past.length})
        </h3>
        {past.length === 0 ? (
          <p className="mt-2 text-sm text-brand-darkBlue/60">No past bookings.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {past.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                project={projectsById.get(b.projectId) ?? null}
                office={officesById.get(b.officeId) ?? null}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
