import type {
  Booking,
  Flag,
  FlagSeverity,
  FlagThresholds,
  FlagType,
  Project,
  PublicUser,
  TaskEntry,
  TimeClockEvent,
} from "@/lib/types";
import { startOfDay } from "@/lib/domain/worked-hours";
import { getBusinessWeekDays, isDateInWeek } from "@/lib/domain/task-entry-grid";

/**
 * A detected flag-worthy situation, before it's reconciled against any
 * persisted dismissal. `key` identifies one recurring situation (e.g. one
 * specific booking, or a trainer's current activity drought); `signature`
 * captures how "bad" it currently is — the store resurfaces a dismissed
 * flag once a fresh computation's signature no longer matches what was
 * dismissed (it got worse, or resolved and later happened again).
 */
export interface FlagCandidate {
  key: string;
  trainerId: string;
  type: FlagType;
  signature: string;
  severity: FlagSeverity;
  message: string;
  relatedBookingId?: string;
  relatedProjectId?: string;
}

export interface ComputeFlagCandidatesInput {
  trainers: PublicUser[];
  bookings: Booking[];
  taskEntries: TaskEntry[];
  timeClockEvents: TimeClockEvent[];
  projects: Project[];
  thresholds: FlagThresholds;
  now: Date;
}

function daysSince(from: Date, now: Date): number {
  const ms = startOfDay(now).getTime() - startOfDay(from).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function earliest(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  return dates.reduce((min, d) => (d < min ? d : min));
}

function latest(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  return dates.reduce((max, d) => (d > max ? d : max));
}

/** Computes every currently-applicable flag situation across all active trainers. Pure — no persistence, no I/O. */
export function computeFlagCandidates({
  trainers,
  bookings,
  taskEntries,
  timeClockEvents,
  projects,
  thresholds,
  now,
}: ComputeFlagCandidatesInput): FlagCandidate[] {
  const candidates: FlagCandidate[] = [];
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  for (const trainer of trainers) {
    if (!trainer.active) continue;

    const trainerBookings = bookings.filter((b) => b.trainerId === trainer.id);
    const acceptedBookings = trainerBookings.filter((b) => b.status === "accepted");
    const trainerEntries = taskEntries.filter((e) => e.trainerId === trainer.id);
    const trainerEvents = timeClockEvents.filter((e) => e.trainerId === trainer.id);
    const entryDates = trainerEntries.map((e) => new Date(`${e.date}T00:00:00`));
    const lastEntryDate = latest(entryDates);

    // 1. Accepted booking, nothing logged in that booking's business week —
    // only once the booking's date has actually arrived.
    for (const booking of acceptedBookings) {
      const startTime = new Date(booking.startTime);
      if (startTime > now) continue;

      const week = getBusinessWeekDays(startTime);
      const hasEntryThatWeek = trainerEntries.some((e) => isDateInWeek(e.date, week));
      if (hasEntryThatWeek) continue;

      const weekEnded = startOfDay(now) > startOfDay(week[week.length - 1]);
      const severity: FlagSeverity = weekEnded ? "warning" : "info";
      const project = projectsById.get(booking.projectId);

      candidates.push({
        key: `${trainer.id}:accepted_booking_no_hours:${booking.id}`,
        trainerId: trainer.id,
        type: "accepted_booking_no_hours",
        signature: severity,
        severity,
        message: `${trainer.name} was scheduled for "${booking.title}"${
          project ? ` (${project.name})` : ""
        } but hasn't logged any tasks this week.`,
        relatedBookingId: booking.id,
        relatedProjectId: booking.projectId,
      });
    }

    // 2. Unsubmitted task tracker — quiet for X+ days despite having at
    // least one accepted booking (upcoming or past) to anchor relevance.
    if (acceptedBookings.length > 0) {
      const anchor =
        lastEntryDate ?? earliest(acceptedBookings.map((b) => new Date(b.startTime)));

      if (anchor) {
        const days = daysSince(anchor, now);
        if (days >= thresholds.unsubmittedTaskTrackerDays) {
          const severity: FlagSeverity =
            days >= thresholds.unsubmittedTaskTrackerDays * 2 ? "warning" : "info";

          candidates.push({
            key: `${trainer.id}:unsubmitted_task_tracker`,
            trainerId: trainer.id,
            type: "unsubmitted_task_tracker",
            signature: severity,
            severity,
            message: `${trainer.name} hasn't logged any Task Tracker entries in ${days} day${
              days === 1 ? "" : "s"
            }.`,
          });
        }
      }
    }

    // 3. Pending booking whose start time is inside the "unanswered" window.
    for (const booking of trainerBookings) {
      if (booking.status !== "pending") continue;

      const hoursUntilStart =
        (new Date(booking.startTime).getTime() - now.getTime()) / (60 * 60 * 1000);
      if (hoursUntilStart > thresholds.pendingBookingUnansweredHours) continue;

      const severity: FlagSeverity =
        hoursUntilStart <= thresholds.pendingBookingUnansweredHours / 2
          ? "warning"
          : "info";
      const project = projectsById.get(booking.projectId);
      const projectSuffix = project ? ` (${project.name})` : "";

      candidates.push({
        key: `${trainer.id}:pending_booking_unanswered:${booking.id}`,
        trainerId: trainer.id,
        type: "pending_booking_unanswered",
        signature: severity,
        severity,
        message:
          hoursUntilStart <= 0
            ? `${trainer.name} has a pending booking "${booking.title}"${projectSuffix} that already started and still hasn't been accepted or rejected.`
            : `${trainer.name} has a pending booking "${booking.title}"${projectSuffix} starting in ${Math.round(
                hoursUntilStart
              )}h that hasn't been accepted or rejected.`,
        relatedBookingId: booking.id,
        relatedProjectId: booking.projectId,
      });
    }

    // 4. Booking cancellation requested — awaiting an admin's approve/deny.
    for (const booking of trainerBookings) {
      if (booking.status !== "cancellation_requested") continue;

      const project = projectsById.get(booking.projectId);
      const projectSuffix = project ? ` (${project.name})` : "";
      const reasonSuffix = booking.cancellationReason
        ? ` — "${booking.cancellationReason}"`
        : "";

      candidates.push({
        key: `${trainer.id}:cancellation_requested:${booking.id}`,
        trainerId: trainer.id,
        type: "cancellation_requested",
        signature: booking.cancellationReason ?? "",
        severity: "warning",
        message: `${trainer.name} requested to cancel "${booking.title}"${projectSuffix}${reasonSuffix}.`,
        relatedBookingId: booking.id,
        relatedProjectId: booking.projectId,
      });
    }

    // 5. Total inactivity — no clock events and no task entries for X+ days.
    const lastEventDate = latest(trainerEvents.map((e) => new Date(e.timestamp)));
    const lastActivity = latest(
      [lastEntryDate, lastEventDate].filter((d): d is Date => d !== null)
    );
    const anchor = lastActivity ?? earliest(trainerBookings.map((b) => new Date(b.startTime)));

    if (anchor) {
      const days = daysSince(anchor, now);
      if (days >= thresholds.inactiveTrainerDays) {
        const severity: FlagSeverity =
          days >= thresholds.inactiveTrainerDays * 2 ? "warning" : "info";

        candidates.push({
          key: `${trainer.id}:trainer_inactive`,
          trainerId: trainer.id,
          type: "trainer_inactive",
          signature: severity,
          severity,
          message: `${trainer.name} has had no clock-in or Task Tracker activity for ${days} day${
            days === 1 ? "" : "s"
          }.`,
        });
      }
    }
  }

  return candidates;
}

export type EnrichedFlag = Flag & {
  trainer: PublicUser | null;
  relatedBooking: Booking | null;
  relatedProject: Project | null;
};

/** Joins each flag to its trainer and (if present) related booking/project — shared by the API route and the server-rendered Flags pages so neither reimplements the lookup. */
export function enrichFlags(
  flags: Flag[],
  trainers: PublicUser[],
  bookings: Booking[],
  projects: Project[]
): EnrichedFlag[] {
  const trainersById = new Map(trainers.map((t) => [t.id, t]));
  const bookingsById = new Map(bookings.map((b) => [b.id, b]));
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  return flags.map((flag) => ({
    ...flag,
    trainer: trainersById.get(flag.trainerId) ?? null,
    relatedBooking: flag.relatedBookingId
      ? bookingsById.get(flag.relatedBookingId) ?? null
      : null,
    relatedProject: flag.relatedProjectId
      ? projectsById.get(flag.relatedProjectId) ?? null
      : null,
  }));
}
