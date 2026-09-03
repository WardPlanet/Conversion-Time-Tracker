import type { TimeClockEvent } from "@/lib/types";
import { groupEventsIntoSessions } from "@/lib/domain/time-clock-sessions";

interface Shift {
  clockInMs: number;
  clockOutMs: number | null;
  breaks: Array<{ startMs: number; endMs: number | null }>;
}

/** Same clock_in→clock_out walk as {@link groupEventsIntoSessions}, just reduced to plain ms for the overlap math below. */
function buildShifts(events: TimeClockEvent[]): Shift[] {
  return groupEventsIntoSessions(events).map((session) => ({
    clockInMs: new Date(session.clockIn.timestamp).getTime(),
    clockOutMs: session.clockOut
      ? new Date(session.clockOut.timestamp).getTime()
      : null,
    breaks: session.breaks.map((brk) => ({
      startMs: new Date(brk.start.timestamp).getTime(),
      endMs: brk.end ? new Date(brk.end.timestamp).getTime() : null,
    })),
  }));
}

function overlapMs(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/**
 * Sums worked time (clocked in, minus breaks) that falls within
 * [rangeStart, rangeEnd). An ongoing shift or break counts up to `now`.
 */
export function computeWorkedMs(
  events: TimeClockEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  now: Date = new Date()
): number {
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  const nowMs = now.getTime();

  let totalMs = 0;
  for (const shift of buildShifts(events)) {
    const shiftEndMs = shift.clockOutMs ?? nowMs;
    totalMs += overlapMs(shift.clockInMs, shiftEndMs, rangeStartMs, rangeEndMs);

    for (const brk of shift.breaks) {
      const breakEndMs = brk.endMs ?? nowMs;
      totalMs -= overlapMs(brk.startMs, breakEndMs, rangeStartMs, rangeEndMs);
    }
  }

  return Math.max(0, totalMs);
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function startOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function msToHours(ms: number): number {
  return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
}

/**
 * Buckets worked time into one entry per local day within
 * [rangeStart, rangeEnd), reusing {@link computeWorkedMs} for each day so
 * breaks and ongoing shifts are handled identically to the aggregate total.
 */
export function computeDailyHours(
  events: TimeClockEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  now: Date = new Date()
): Array<{ date: string; hours: number }> {
  const days: Array<{ date: string; hours: number }> = [];
  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);

  while (cursor < rangeEnd) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const clippedEnd = dayEnd < rangeEnd ? dayEnd : rangeEnd;
    const ms = computeWorkedMs(events, dayStart, clippedEnd, now);
    const year = dayStart.getFullYear();
    const month = String(dayStart.getMonth() + 1).padStart(2, "0");
    const day = String(dayStart.getDate()).padStart(2, "0");
    days.push({ date: `${year}-${month}-${day}`, hours: msToHours(ms) });

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}
