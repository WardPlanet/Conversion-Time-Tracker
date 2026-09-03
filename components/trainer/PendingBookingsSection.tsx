"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import { formatDateRange } from "@/lib/format";
import { BillableTag, LocationTag, ProjectDot } from "@/components/trainer/badges";
import { useBookingsContext } from "@/components/trainer/BookingsProvider";
import { RejectReasonModal } from "@/components/trainer/RejectReasonModal";
import { DashboardCard } from "@/components/trainer/DashboardCard";

/**
 * A fast path for accepting/rejecting straight from the Dashboard — same
 * `respond` action (and the same server endpoint) as the Calendar page's
 * own sidebar list, just triggered from here. Shows only the single
 * soonest-scheduled pending booking; once it's resolved, whichever pending
 * booking is next automatically takes its place. Renders nothing at all
 * once there's none left, so the left column doesn't reserve empty space.
 */
export function PendingBookingsSection({ projects }: { projects: Project[] }) {
  const { nextPendingBooking, respond, pendingActionId, error } =
    useBookingsContext();
  const [rejecting, setRejecting] = useState(false);
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  if (!nextPendingBooking) return null;

  const booking = nextPendingBooking;
  const project = projectsById.get(booking.projectId) ?? null;
  const isPending = pendingActionId === booking.id;

  return (
    <DashboardCard title="Pending bookings">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
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
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => respond(booking.id, "accepted")}
            disabled={isPending}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={isPending}
            className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>

      <RejectReasonModal
        open={rejecting}
        onClose={() => setRejecting(false)}
        submitting={isPending}
        onConfirm={(reason) => {
          setRejecting(false);
          respond(booking.id, "rejected", reason);
        }}
      />
    </DashboardCard>
  );
}
