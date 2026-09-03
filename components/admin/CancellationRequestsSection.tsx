"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Booking, Project, PublicUser } from "@/lib/types";
import { formatDateRange } from "@/lib/format";
import { ProjectDot } from "@/components/trainer/badges";
import { selectCancellationRequestedBookings } from "@/lib/domain/trainer-stats";

type EnrichedBooking = Booking & {
  project: Project | null;
  trainer: PublicUser | null;
};

/**
 * Cross-month queue of bookings awaiting a cancellation decision — mirrors
 * the trainer Calendar page's own "Pending bookings" section (a queue above
 * the grid, since these can fall outside whatever month is currently in
 * view). Approving/denying re-fetches via `onDecided` rather than mutating
 * local state, same rationale as the rest of the booking flows.
 */
export function CancellationRequestsSection({
  bookings,
  onDecided,
}: {
  bookings: EnrichedBooking[];
  onDecided: () => void;
}) {
  const requested = selectCancellationRequestedBookings(bookings);

  if (requested.length === 0) return null;

  return (
    <section className="mt-6 rounded-md border border-brand-orange/30 bg-brand-orange/5 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-brand-orange" />
        <h2 className="text-sm font-semibold text-brand-darkBlue">
          Cancellation requests ({requested.length})
        </h2>
      </div>
      <ul className="mt-3 space-y-2">
        {requested.map((b) => (
          <CancellationRequestCard
            key={b.id}
            booking={b}
            onDecided={onDecided}
          />
        ))}
      </ul>
    </section>
  );
}

export function CancellationRequestCard({
  booking,
  onDecided,
}: {
  booking: EnrichedBooking;
  onDecided: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "deny") {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/bookings/${booking.id}/cancellation`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to update booking.");
        return;
      }

      onDecided();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {booking.project && <ProjectDot color={booking.project.color} />}
            <span className="text-sm font-medium text-brand-darkBlue">
              {booking.trainer?.name ?? "Unknown trainer"}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-brand-darkBlue/70">
            {booking.title}
          </p>
          <p className="mt-1 text-xs text-brand-darkBlue/50">
            {formatDateRange(booking.startTime, booking.endTime)}
          </p>
          {booking.cancellationReason && (
            <p className="mt-2 text-sm text-brand-darkBlue/70">
              “{booking.cancellationReason}”
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide("approve")}
            disabled={submitting}
            className="rounded-md bg-brand-green px-3 py-1 text-sm font-medium text-white hover:bg-brand-green/90 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => decide("deny")}
            disabled={submitting}
            className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-sm hover:bg-brand-blueWater disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      </div>
    </li>
  );
}
