import type { DataStore } from "@/lib/data/store";
import type { Booking } from "@/lib/types";
import {
  computeWorkedMs,
  msToHours,
  startOfMonth,
  startOfWeek,
} from "@/lib/domain/worked-hours";

export interface TrainerStats {
  hoursThisWeek: number;
  hoursThisMonth: number;
  tasksCompletedCount: number;
  pendingBookings: Booking[];
  upcomingAcceptedBookings: Booking[];
}

/**
 * Soonest-scheduled first — the one a trainer should respond to next.
 * Generic so callers enriched with extra fields (e.g. a joined `project`)
 * get that shape back instead of a plain `Booking`.
 */
export function selectPendingBookings<T extends Booking>(bookings: T[]): T[] {
  return bookings
    .filter((b) => b.status === "pending")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Soonest-first bookings that haven't started yet and are still on the
 * trainer's calendar — accepted, or accepted-but-cancellation-requested
 * (still active until an admin resolves it) — capped to `limit`.
 */
export function selectUpcomingAcceptedBookings(
  bookings: Booking[],
  now: Date,
  limit = 5
): Booking[] {
  return bookings
    .filter(
      (b) =>
        (b.status === "accepted" || b.status === "cancellation_requested") &&
        new Date(b.startTime) >= now
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, limit);
}

/**
 * Every booking currently awaiting admin review of a cancellation request.
 * Generic so callers enriched with extra fields (e.g. a joined `project`/
 * `trainer`) get that shape back instead of a plain `Booking`.
 */
export function selectCancellationRequestedBookings<T extends Booking>(
  bookings: T[]
): T[] {
  return bookings
    .filter((b) => b.status === "cancellation_requested")
    .sort((a, b) => a.statusChangedAt.localeCompare(b.statusChangedAt));
}

export const UNDO_WINDOW_HOURS = 24;

/** Whether a trainer can still self-service revert a status change back to pending. */
export function isWithinUndoWindow(
  statusChangedAt: string,
  now: Date = new Date()
): boolean {
  const elapsedMs = now.getTime() - new Date(statusChangedAt).getTime();
  return elapsedMs <= UNDO_WINDOW_HOURS * 60 * 60 * 1000;
}

/**
 * Most-recently-rejected first, dropping anything rejected more than `days`
 * ago. Generic so callers enriched with extra fields (e.g. a joined
 * `project`) get that shape back instead of a plain `Booking`.
 */
export function selectRecentRejectedBookings<T extends Booking>(
  bookings: T[],
  now: Date,
  days = 30
): T[] {
  const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;
  return bookings
    .filter(
      (b) => b.status === "rejected" && new Date(b.statusChangedAt).getTime() >= cutoffMs
    )
    .sort((a, b) => b.statusChangedAt.localeCompare(a.statusChangedAt));
}

/**
 * The stat set shown on a trainer's own dashboard — reused as-is for the
 * admin-side Stats tab on a trainer's profile, just scoped to a given
 * `trainerId` instead of the logged-in session's user.
 */
export async function computeTrainerStats(
  store: DataStore,
  trainerId: string,
  now: Date = new Date()
): Promise<TrainerStats> {
  const [events, tasks, bookings] = await Promise.all([
    store.listTimeClockEvents(trainerId),
    store.listTasksForTrainer(trainerId),
    store.listBookingsForTrainer(trainerId),
  ]);

  const hoursThisWeek = msToHours(
    computeWorkedMs(events, startOfWeek(now), now, now)
  );
  const hoursThisMonth = msToHours(
    computeWorkedMs(events, startOfMonth(now), now, now)
  );

  const tasksCompletedCount = tasks.filter(
    (t) => t.status === "completed"
  ).length;

  const pendingBookings = selectPendingBookings(bookings);
  const upcomingAcceptedBookings = selectUpcomingAcceptedBookings(bookings, now);

  return {
    hoursThisWeek,
    hoursThisMonth,
    tasksCompletedCount,
    pendingBookings,
    upcomingAcceptedBookings,
  };
}
