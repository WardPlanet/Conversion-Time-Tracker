"use client";

import { Calendar, CalendarClock } from "lucide-react";
import type { Project } from "@/lib/types";
import { formatDateRange } from "@/lib/format";
import {
  BillableTag,
  BookingStatusTag,
  ProjectDot,
} from "@/components/trainer/badges";
import { useBookingsContext } from "@/components/trainer/BookingsProvider";

const LOCATION_LABEL = { on_site: "On-site", remote: "Remote" } as const;

/** The full-width banner above the two-column section — the trainer's single most time-sensitive fact, so it gets top billing on its own row. */
export function NextBookingCard({ projects }: { projects: Project[] }) {
  const { nextBooking, pendingBookings } = useBookingsContext();
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const nextBookingProject = nextBooking
    ? projectsById.get(nextBooking.projectId) ?? null
    : null;

  return (
    <div className="flex items-center gap-5 rounded-md border border-brand-darkBlue/10 bg-white p-5 shadow-sm">
      {nextBooking ? (
        <>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-darkBlue/40">
              Next upcoming booking
            </p>
            <p className="mt-1 truncate text-base font-semibold text-brand-darkBlue">
              {nextBooking.title}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-brand-darkBlue/60">
              {nextBookingProject && (
                <ProjectDot color={nextBookingProject.color} />
              )}
              {nextBookingProject?.name ?? "Unknown project"} ·{" "}
              {formatDateRange(nextBooking.startTime, nextBooking.endTime)} ·{" "}
              {LOCATION_LABEL[nextBooking.location]}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <BillableTag billable={nextBooking.billable} />
            {nextBooking.status === "cancellation_requested" && (
              <BookingStatusTag status={nextBooking.status} />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-blueWater text-brand-darkBlue/40">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-darkBlue/40">
              Next upcoming booking
            </p>
            <p className="mt-1 text-sm text-brand-darkBlue/60">
              {pendingBookings.length > 0
                ? "No upcoming bookings yet — see the pending bookings below."
                : "No upcoming bookings."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
