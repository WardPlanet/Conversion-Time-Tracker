"use client";

import type { Project } from "@/lib/types";
import { formatDateRange } from "@/lib/format";
import { BillableTag, LocationTag, ProjectDot } from "@/components/trainer/badges";
import { useBookingsContext } from "@/components/trainer/BookingsProvider";
import { DashboardCard } from "@/components/trainer/DashboardCard";

export function PendingBookingsSection({ projects }: { projects: Project[] }) {
  const { nextPendingBooking } = useBookingsContext();
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  if (!nextPendingBooking) return null;

  const booking = nextPendingBooking;
  const project = projectsById.get(booking.projectId) ?? null;

  return (
    <DashboardCard title="Pending bookings">
      <div className="rounded-md border border-brand-darkBlue/10 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {project && <ProjectDot color={project.color} />}
          <span className="text-sm font-medium text-brand-darkBlue">
            {project?.name ?? "Unknown project"}
          </span>
          <span className="text-sm text-brand-darkBlue/60">
            {formatDateRange(booking.startTime, booking.endTime)}
          </span>
          <LocationTag location={booking.location} />
          <BillableTag billable={booking.billable} />
        </div>
        <p className="mt-3 text-xs text-brand-darkBlue/50 italic">
          Awaiting approval from your partner manager.
        </p>
      </div>
    </DashboardCard>
  );
}
