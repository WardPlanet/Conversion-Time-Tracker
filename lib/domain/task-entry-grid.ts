import { addDays, addWeeks, startOfWeek, subWeeks } from "date-fns";
import { toLocalDateString } from "@/lib/format";
import type { Project, Task, TaskEntry } from "@/lib/types";

export type EnrichedTaskEntry = TaskEntry & {
  project: Project | null;
  task: Task | null;
};

/** The business week (Monday–Friday) containing `date`, as 5 `Date`s. */
export function getBusinessWeekDays(date: Date): Date[] {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
}

export function nextBusinessWeek(date: Date): Date {
  return addWeeks(date, 1);
}

export function previousBusinessWeek(date: Date): Date {
  return subWeeks(date, 1);
}

/** Buckets entries first by project, then by local calendar day — the shape a project-rows/day-columns grid renders directly from. */
export function groupEntriesByProjectAndDate<
  T extends { projectId: string; date: string },
>(entries: T[]): Map<string, Map<string, T[]>> {
  const byProject = new Map<string, Map<string, T[]>>();
  for (const entry of entries) {
    let byDate = byProject.get(entry.projectId);
    if (!byDate) {
      byDate = new Map();
      byProject.set(entry.projectId, byDate);
    }
    const bucket = byDate.get(entry.date);
    if (bucket) bucket.push(entry);
    else byDate.set(entry.date, [entry]);
  }
  return byProject;
}

/** Entries whose `date` falls on one of `weekdays` — the basis for "only show what's actually logged this week." */
export function filterEntriesForWeek<T extends { date: string }>(
  entries: T[],
  weekdays: Date[]
): T[] {
  const weekdayDates = new Set(weekdays.map(toLocalDateString));
  return entries.filter((e) => weekdayDates.has(e.date));
}

/** Whether a "YYYY-MM-DD" date string falls on one of `weekdays`. */
export function isDateInWeek(date: string, weekdays: Date[]): boolean {
  return weekdays.some((d) => toLocalDateString(d) === date);
}

/** Sum of `hours` across every entry — e.g. a "total hours logged this week" figure. */
export function sumHours(entries: { hours: number }[]): number {
  return entries.reduce((sum, e) => sum + e.hours, 0);
}

/** Total hours per local "YYYY-MM-DD" date, across every project — the basis for a totals row under a project-rows/day-columns grid. */
export function sumHoursByDate<T extends { date: string; hours: number }>(
  entries: T[]
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.date, (totals.get(entry.date) ?? 0) + entry.hours);
  }
  return totals;
}
