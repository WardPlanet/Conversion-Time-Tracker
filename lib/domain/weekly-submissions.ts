import type { PublicUser, TaskEntry, WeeklySubmission } from "@/lib/types";
import {
  filterEntriesForWeek,
  getBusinessWeekDays,
  sumHours,
} from "@/lib/domain/task-entry-grid";
import { parseLocalDateString, toLocalDateString } from "@/lib/format";

/** The Monday ("YYYY-MM-DD") of the business week containing `dateStr`. */
export function weekStartDateFor(dateStr: string): string {
  return toLocalDateString(getBusinessWeekDays(parseLocalDateString(dateStr))[0]);
}

/** "8/3 – 8/7" for the business week starting `weekStartDate`. */
export function formatWeekLabel(weekStartDate: string): string {
  const weekdays = getBusinessWeekDays(parseLocalDateString(weekStartDate));
  return `${weekdays[0].getMonth() + 1}/${weekdays[0].getDate()} – ${
    weekdays[4].getMonth() + 1
  }/${weekdays[4].getDate()}`;
}

/** The one submission (if any) matching `weekStartDate` in an already trainer-scoped list. */
export function findWeekSubmission(
  submissions: WeeklySubmission[],
  weekStartDate: string
): WeeklySubmission | null {
  return submissions.find((s) => s.weekStartDate === weekStartDate) ?? null;
}

export type WeekLockState = "locked" | "unlocked_by_rejection" | "normal";

/**
 * Whether a week's entries are locked by its submission — shared by
 * `MockDataStore`'s authoritative enforcement (in `createTaskEntry`/
 * `updateTaskEntry`) and the Task Tracker page's UI, so the two can never
 * disagree about what's editable.
 *
 * - "locked": submitted or approved — no edits, no new entries.
 * - "unlocked_by_rejection": rejected — editable even if it's a past week,
 *   overriding the normal current-week-only edit rule.
 * - "normal": no submission yet (draft) — the normal rules apply as-is.
 */
export function computeWeekLockState(
  submission: WeeklySubmission | null
): WeekLockState {
  if (!submission) return "normal";
  if (submission.status === "submitted" || submission.status === "approved") {
    return "locked";
  }
  if (submission.status === "rejected") {
    return "unlocked_by_rejection";
  }
  return "normal";
}

export type EnrichedWeeklySubmission = WeeklySubmission & {
  trainer: PublicUser | null;
  weekLabel: string;
  totalHours: number;
};

/**
 * Joins each submission to its trainer, a human-readable week range, and
 * that week's total logged hours — shared by the admin review queue and the
 * trainer-profile Task Log tab so neither reimplements the lookup.
 */
export function enrichWeeklySubmissions(
  submissions: WeeklySubmission[],
  trainers: PublicUser[],
  allTaskEntries: TaskEntry[]
): EnrichedWeeklySubmission[] {
  const trainersById = new Map(trainers.map((t) => [t.id, t]));

  return submissions.map((submission) => {
    const weekdays = getBusinessWeekDays(
      parseLocalDateString(submission.weekStartDate)
    );
    const trainerEntries = allTaskEntries.filter(
      (e) => e.trainerId === submission.trainerId
    );
    const weekEntries = filterEntriesForWeek(trainerEntries, weekdays);

    return {
      ...submission,
      trainer: trainersById.get(submission.trainerId) ?? null,
      weekLabel: formatWeekLabel(submission.weekStartDate),
      totalHours: sumHours(weekEntries),
    };
  });
}
