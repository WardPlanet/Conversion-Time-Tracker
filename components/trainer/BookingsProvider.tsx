"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Booking, BookingStatus } from "@/lib/types";
import { respondToBooking } from "@/lib/domain/booking-actions";
import {
  selectPendingBookings,
  selectUpcomingAcceptedBookings,
} from "@/lib/domain/trainer-stats";
import { useToast } from "@/components/ToastProvider";

type RespondableStatus = Extract<BookingStatus, "accepted" | "rejected" | "pending">;

interface BookingsContextValue {
  pendingBookings: Booking[];
  nextPendingBooking: Booking | null;
  nextBooking: Booking | null;
  respond: (
    bookingId: string,
    status: RespondableStatus,
    reason?: string
  ) => Promise<void>;
  pendingActionId: string | null;
  error: string | null;
}

const BookingsContext = createContext<BookingsContextValue | null>(null);

/**
 * Owns the trainer's booking list client-side so the "Pending bookings" stat
 * card, the featured "Next upcoming booking" card, and the dashboard's
 * single-pending-booking section all reflect the same accept/reject
 * immediately, without a full page reload — the server component seeds it
 * once from `store.listBookingsForTrainer`.
 */
export function BookingsProvider({
  initialBookings,
  now,
  children,
}: {
  initialBookings: Booking[];
  now: string;
  children: ReactNode;
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const nowDate = useMemo(() => new Date(now), [now]);

  // Soonest-scheduled first — see selectPendingBookings.
  const pendingBookings = useMemo(
    () => selectPendingBookings(bookings),
    [bookings]
  );
  const nextPendingBooking = pendingBookings[0] ?? null;
  const nextBooking = useMemo(
    () => selectUpcomingAcceptedBookings(bookings, nowDate, 1)[0] ?? null,
    [bookings, nowDate]
  );

  const respond = useCallback(
    async (bookingId: string, status: RespondableStatus, reason?: string) => {
      setError(null);
      setPendingActionId(bookingId);
      try {
        const result = await respondToBooking(bookingId, status, reason);
        if (result.error) {
          setError(result.error);
          return;
        }
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId ? result.booking ?? { ...b, status } : b
          )
        );
        if (status === "accepted" || status === "rejected") {
          showToast({
            message: status === "accepted" ? "Booking accepted" : "Booking rejected",
            onUndo: () => respond(bookingId, "pending"),
          });
        }
      } finally {
        setPendingActionId(null);
      }
    },
    [showToast]
  );

  const value = useMemo(
    () => ({
      pendingBookings,
      nextPendingBooking,
      nextBooking,
      respond,
      pendingActionId,
      error,
    }),
    [pendingBookings, nextPendingBooking, nextBooking, respond, pendingActionId, error]
  );

  return (
    <BookingsContext.Provider value={value}>
      {children}
    </BookingsContext.Provider>
  );
}

export function useBookingsContext() {
  const ctx = useContext(BookingsContext);
  if (!ctx) {
    throw new Error("useBookingsContext must be used within a BookingsProvider");
  }
  return ctx;
}
