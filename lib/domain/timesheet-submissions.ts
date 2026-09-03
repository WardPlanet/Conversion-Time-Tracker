import type { PublicUser, TimeClockEvent, TimesheetSubmission } from "@/lib/types";
import { computeWorkedMs, msToHours } from "@/lib/domain/worked-hours";
import { getBusinessWeekDays } from "@/lib/domain/task-entry-grid";
import { formatWeekLabel } from "@/lib/domain/weekly-submissions";
import { parseLocalDateString } from "@/lib/format";

export {
  computeWeekLockState,
  formatWeekLabel,
  weekStartDateFor,
} from "@/lib/domain/weekly-submissions";
export type { WeekLockState } from "@/lib/domain/weekly-submissions";

/** The one submission (if any) matching `weekStartDate` in an already trainer-scoped list. */
export function findTimesheetWeekSubmission(
  submissions: TimesheetSubmission[],
  weekStartDate: string
): TimesheetSubmission | null {
  return submissions.find((s) => s.weekStartDate === weekStartDate) ?? null;
}

export type EnrichedTimesheetSubmission = TimesheetSubmission & {
  trainer: PublicUser | null;
  weekLabel: string;
  totalHours: number;
};

/**
 * Joins each submission to its trainer, a human-readable week range, and
 * that week's total worked hours (clocked in, minus breaks) — the
 * time-clock counterpart to `enrichWeeklySubmissions`.
 */
export function enrichTimesheetSubmissions(
  submissions: TimesheetSubmission[],
  trainers: PublicUser[],
  allEvents: TimeClockEvent[]
): EnrichedTimesheetSubmission[] {
  const trainersById = new Map(trainers.map((t) => [t.id, t]));
  const now = new Date();

  return submissions.map((submission) => {
    const weekdays = getBusinessWeekDays(
      parseLocalDateString(submission.weekStartDate)
    );
    const rangeStart = weekdays[0];
    const rangeEnd = new Date(weekdays[4]);
    rangeEnd.setDate(rangeEnd.getDate() + 1);

    const trainerEvents = allEvents.filter(
      (e) => e.trainerId === submission.trainerId
    );
    const totalHours = msToHours(
      computeWorkedMs(trainerEvents, rangeStart, rangeEnd, now)
    );

    return {
      ...submission,
      trainer: trainersById.get(submission.trainerId) ?? null,
      weekLabel: formatWeekLabel(submission.weekStartDate),
      totalHours,
    };
  });
}
