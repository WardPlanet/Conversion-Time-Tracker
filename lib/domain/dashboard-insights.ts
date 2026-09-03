import { addWeeks, format, startOfWeek, subWeeks } from "date-fns";
import { toLocalDateString } from "@/lib/format";
import type { Booking, Project, Task, TaskEntry } from "@/lib/types";

export interface BillableSplit {
  billableHours: number;
  nonBillableHours: number;
}

/**
 * Billable/non-billable hours split for entries within [rangeStart, rangeEnd]
 * (inclusive), using each entry's linked `Task.billable` as the source of
 * truth — a checklist task's billable status is authored once by an admin
 * and applies to every hour logged against it, unlike a booking's billable
 * status, which a TaskEntry may not even have (not every entry is tied to
 * a booking). Falls back to the old linked-accepted-booking signal only for
 * the edge case of an entry whose `taskId` doesn't resolve to a known task
 * (shouldn't normally happen).
 */
export function computeBillableSplit(
  entries: TaskEntry[],
  tasks: Task[],
  bookings: Booking[],
  rangeStart: Date,
  rangeEnd: Date
): BillableSplit {
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const bookingsById = new Map(bookings.map((b) => [b.id, b]));
  const startStr = toLocalDateString(rangeStart);
  const endStr = toLocalDateString(rangeEnd);

  let billableHours = 0;
  let nonBillableHours = 0;

  for (const entry of entries) {
    if (entry.date < startStr || entry.date > endStr) continue;

    const task = tasksById.get(entry.taskId);
    if (task) {
      if (task.billable) billableHours += entry.hours;
      else nonBillableHours += entry.hours;
      continue;
    }

    // Safety net for an entry whose task can't be resolved.
    if (!entry.bookingId) continue;
    const booking = bookingsById.get(entry.bookingId);
    if (!booking || booking.status !== "accepted") continue;
    if (booking.billable === "billable") billableHours += entry.hours;
    else nonBillableHours += entry.hours;
  }

  return {
    billableHours: Math.round(billableHours * 100) / 100,
    nonBillableHours: Math.round(nonBillableHours * 100) / 100,
  };
}

/**
 * Total logged hours across `entries` within [rangeStart, rangeEnd]
 * (inclusive) — the org-wide counterpart to a trainer's own week/month
 * hours stat, just summed from Task Tracker entries (not clock events) so
 * it lines up with the billable split and trend chart below it, which are
 * computed from the same source.
 */
export function computeTotalHours(
  entries: TaskEntry[],
  rangeStart: Date,
  rangeEnd: Date
): number {
  const startStr = toLocalDateString(rangeStart);
  const endStr = toLocalDateString(rangeEnd);

  const hours = entries
    .filter((e) => e.date >= startStr && e.date <= endStr)
    .reduce((sum, e) => sum + e.hours, 0);

  return Math.round(hours * 100) / 100;
}

export interface LocationSplit {
  onSiteHours: number;
  remoteHours: number;
}

/**
 * On-site/remote hours split for entries within [rangeStart, rangeEnd]
 * (inclusive) — same linked-accepted-booking approach as
 * {@link computeBillableSplit}, just reading `Booking.location` instead of
 * `Booking.billable`.
 */
export function computeLocationSplit(
  entries: TaskEntry[],
  bookings: Booking[],
  rangeStart: Date,
  rangeEnd: Date
): LocationSplit {
  const bookingsById = new Map(bookings.map((b) => [b.id, b]));
  const startStr = toLocalDateString(rangeStart);
  const endStr = toLocalDateString(rangeEnd);

  let onSiteHours = 0;
  let remoteHours = 0;

  for (const entry of entries) {
    if (entry.date < startStr || entry.date > endStr) continue;
    if (!entry.bookingId) continue;
    const booking = bookingsById.get(entry.bookingId);
    if (!booking || booking.status !== "accepted") continue;
    if (booking.location === "on_site") onSiteHours += entry.hours;
    else remoteHours += entry.hours;
  }

  return {
    onSiteHours: Math.round(onSiteHours * 100) / 100,
    remoteHours: Math.round(remoteHours * 100) / 100,
  };
}

export interface ProjectTaskProgress {
  project: Project;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
}

/**
 * One row per project the trainer has checklist tasks on — the same
 * completed/total/percent math already used on the Projects tab, extracted
 * here so the dashboard summary and that page compute it identically rather
 * than each keeping their own copy.
 */
export function computeProjectTaskProgress(
  tasks: Task[],
  projects: Project[]
): ProjectTaskProgress[] {
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const tasksByProject = new Map<string, Task[]>();
  for (const task of tasks) {
    const bucket = tasksByProject.get(task.projectId);
    if (bucket) bucket.push(task);
    else tasksByProject.set(task.projectId, [task]);
  }

  const rows: ProjectTaskProgress[] = [];
  for (const [projectId, projectTasks] of tasksByProject) {
    const project = projectsById.get(projectId);
    if (!project) continue;
    const completedCount = projectTasks.filter(
      (t) => t.status === "completed"
    ).length;
    const totalCount = projectTasks.length;
    rows.push({
      project,
      completedCount,
      totalCount,
      progressPercent:
        totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
    });
  }

  return rows.sort((a, b) => a.project.name.localeCompare(b.project.name));
}

export interface WeeklyHours {
  weekStart: string; // "YYYY-MM-DD" (Monday)
  label: string; // e.g. "Jun 15"
  hours: number;
}

/**
 * Total logged hours per Monday-start week for the last `weekCount` weeks,
 * newest (the current, possibly partial week) last — matches the same
 * business-week boundaries the Task Tracker grid already uses.
 */
export function computeWeeklyHoursTrend(
  entries: TaskEntry[],
  weekCount: number,
  now: Date = new Date()
): WeeklyHours[] {
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weeks: WeeklyHours[] = [];

  for (let i = weekCount - 1; i >= 0; i--) {
    const weekStart = subWeeks(currentWeekStart, i);
    const weekEndExclusive = addWeeks(weekStart, 1);
    const startStr = toLocalDateString(weekStart);
    const endStr = toLocalDateString(weekEndExclusive);

    const hours = entries
      .filter((e) => e.date >= startStr && e.date < endStr)
      .reduce((sum, e) => sum + e.hours, 0);

    weeks.push({
      weekStart: startStr,
      label: format(weekStart, "MMM d"),
      hours: Math.round(hours * 100) / 100,
    });
  }

  return weeks;
}
