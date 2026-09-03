import { toLocalDateString } from "@/lib/format";
import type { TimeClockEvent } from "@/lib/types";

export interface ClockSessionBreak {
  start: TimeClockEvent;
  /** Null while the break is still ongoing. */
  end: TimeClockEvent | null;
}

export interface ClockSession {
  clockIn: TimeClockEvent;
  /** Null while the trainer is still clocked in for this session. */
  clockOut: TimeClockEvent | null;
  breaks: ClockSessionBreak[];
}

/**
 * Walks a trainer's raw events chronologically into clock_in→clock_out
 * sessions, each with its nested breaks — the shared basis for both
 * {@link import("./worked-hours").computeWorkedMs}'s ms math and the
 * Activity log's session display, so the two never disagree on what counts
 * as a "shift."
 */
export function groupEventsIntoSessions(
  events: TimeClockEvent[]
): ClockSession[] {
  const sorted = [...events].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );
  const sessions: ClockSession[] = [];
  let current: ClockSession | null = null;

  for (const event of sorted) {
    if (event.type === "clock_in") {
      current = { clockIn: event, clockOut: null, breaks: [] };
      sessions.push(current);
    } else if (event.type === "break_start" && current) {
      current.breaks.push({ start: event, end: null });
    } else if (event.type === "break_end" && current) {
      const openBreak = current.breaks.find((b) => b.end === null);
      if (openBreak) openBreak.end = event;
    } else if (event.type === "clock_out" && current) {
      current.clockOut = event;
      current = null;
    }
  }

  return sessions;
}

export interface DailySessionGroup {
  /** Local "YYYY-MM-DD" of the sessions' `clockIn` — a session that crosses midnight is grouped under the day it started. */
  date: string;
  /** Most-recent session first. */
  sessions: ClockSession[];
}

/** Buckets sessions by the local day they started, most-recent day (and, within a day, most-recent session) first. */
export function groupSessionsByDay(
  sessions: ClockSession[]
): DailySessionGroup[] {
  const byDate = new Map<string, ClockSession[]>();
  for (const session of sessions) {
    const date = toLocalDateString(new Date(session.clockIn.timestamp));
    const bucket = byDate.get(date);
    if (bucket) bucket.push(session);
    else byDate.set(date, [session]);
  }

  return Array.from(byDate.entries())
    .map(([date, daySessions]) => ({
      date,
      sessions: [...daySessions].sort((a, b) =>
        b.clockIn.timestamp.localeCompare(a.clockIn.timestamp)
      ),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** A session's worked time (excluding breaks) — an open session or open break counts up to `now`. */
export function sessionWorkedMs(
  session: ClockSession,
  now: Date = new Date()
): number {
  const clockInMs = new Date(session.clockIn.timestamp).getTime();
  const clockOutMs = session.clockOut
    ? new Date(session.clockOut.timestamp).getTime()
    : now.getTime();

  let ms = clockOutMs - clockInMs;
  for (const brk of session.breaks) {
    ms -= breakDurationMs(brk, now);
  }
  return Math.max(0, ms);
}

/** A single break's duration — an open break counts up to `now`. */
export function breakDurationMs(
  brk: ClockSessionBreak,
  now: Date = new Date()
): number {
  const startMs = new Date(brk.start.timestamp).getTime();
  const endMs = brk.end ? new Date(brk.end.timestamp).getTime() : now.getTime();
  return Math.max(0, endMs - startMs);
}
