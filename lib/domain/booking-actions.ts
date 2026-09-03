import type { Booking, BookingStatus } from "@/lib/types";

export interface RespondToBookingResult {
  booking?: Booking;
  error?: string;
}

type RespondableStatus = Extract<BookingStatus, "accepted" | "rejected" | "pending">;

/**
 * The trainer accept/reject/undo call — shared by the Calendar page's
 * sidebar list/modal/rejected-archive and the Dashboard's pending-bookings
 * fast path so none of them duplicates the fetch to
 * `/api/trainer/bookings/:id`. `status: "pending"` is the undo path (only
 * legal within the store's undo window); `reason` is only meaningful for
 * `status: "rejected"`.
 */
export async function respondToBooking(
  bookingId: string,
  status: RespondableStatus,
  reason?: string
): Promise<RespondToBookingResult> {
  const response = await fetch(`/api/trainer/bookings/${bookingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reason }),
  });
  const data = await response.json();

  if (!response.ok) {
    return { error: data.error ?? "Failed to update booking." };
  }
  return { booking: data.booking };
}

/**
 * A trainer backing out of an already-`"accepted"` booking — separate from
 * {@link respondToBooking}'s pending/accept/reject flow. `reason` is
 * required; the booking stays active until an admin approves or denies it.
 */
export async function requestBookingCancellation(
  bookingId: string,
  reason: string
): Promise<RespondToBookingResult> {
  const response = await fetch(
    `/api/trainer/bookings/${bookingId}/cancellation-request`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }
  );
  const data = await response.json();

  if (!response.ok) {
    return { error: data.error ?? "Failed to request cancellation." };
  }
  return { booking: data.booking };
}
