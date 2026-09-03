import type { Booking, BookingStatus } from "@/lib/types";

/**
 * Only these statuses represent time actually held on a trainer's calendar.
 * A rejected/cancelled booking freed up that slot, so it can't conflict with
 * a new one. A cancellation request hasn't been approved yet, so the slot
 * stays held until an admin resolves it.
 */
const ACTIVE_STATUSES: BookingStatus[] = [
  "pending",
  "accepted",
  "cancellation_requested",
];

export interface BookingWindow {
  startTime: string;
  endTime: string;
}

/**
 * Returns the first of the trainer's active bookings that overlaps
 * `window`, or `null` if the trainer is free. Pass `excludeBookingId` when
 * checking a booking against its own prior version (e.g. while rescheduling).
 */
export function findConflictingBooking(
  existingBookings: Booking[],
  trainerId: string,
  window: BookingWindow,
  excludeBookingId?: string
): Booking | null {
  const newStart = new Date(window.startTime).getTime();
  const newEnd = new Date(window.endTime).getTime();

  return (
    existingBookings.find((b) => {
      if (b.trainerId !== trainerId) return false;
      if (b.id === excludeBookingId) return false;
      if (!ACTIVE_STATUSES.includes(b.status)) return false;

      const existingStart = new Date(b.startTime).getTime();
      const existingEnd = new Date(b.endTime).getTime();
      return existingStart < newEnd && existingEnd > newStart;
    }) ?? null
  );
}
