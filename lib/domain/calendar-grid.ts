import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";
import { toLocalDateString } from "@/lib/format";

/**
 * Every week (Sunday–Saturday) needed to render a full month grid, including
 * leading/trailing days from adjacent months so the grid is always a
 * complete set of 7-day rows.
 */
export function getMonthGridWeeks(month: Date): Date[][] {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

/** The single week (Sunday–Saturday) containing `date`, in the same shape as {@link getMonthGridWeeks}. */
export function getWeekGridWeeks(date: Date): Date[][] {
  const start = startOfWeek(date, { weekStartsOn: 0 });
  const days: Date[] = [];
  let cursor = start;
  for (let i = 0; i < 7; i++) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return [days];
}

/** Buckets items by local calendar day (not UTC), so a grid cell shows exactly what a viewer would expect for that day. */
export function groupByLocalDate<T>(
  items: T[],
  getDate: (item: T) => Date
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = toLocalDateString(getDate(item));
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export interface TimedEvent {
  id: string;
  start: Date;
  end: Date;
}

export interface EventColumnLayout {
  column: number;
  columnCount: number;
}

/**
 * Assigns side-by-side columns to a single day's events, Google-Calendar
 * week-view style: events are grouped into clusters of transitively
 * overlapping time ranges, then packed greedily into the fewest columns
 * within each cluster. Non-overlapping events each get their own
 * full-width column (columnCount 1).
 */
export function layoutDayEvents(
  events: TimedEvent[]
): Map<string, EventColumnLayout> {
  const layout = new Map<string, EventColumnLayout>();
  const sorted = [...events].sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime()
  );

  let cluster: TimedEvent[] = [];
  let clusterEnd = -Infinity;

  function flushCluster() {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    const assigned: { event: TimedEvent; column: number }[] = [];
    for (const event of cluster) {
      let column = columnEnds.findIndex((end) => end <= event.start.getTime());
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(event.end.getTime());
      } else {
        columnEnds[column] = event.end.getTime();
      }
      assigned.push({ event, column });
    }
    const columnCount = columnEnds.length;
    for (const { event, column } of assigned) {
      layout.set(event.id, { column, columnCount });
    }
    cluster = [];
    clusterEnd = -Infinity;
  }

  for (const event of sorted) {
    if (cluster.length > 0 && event.start.getTime() >= clusterEnd) {
      flushCluster();
    }
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.end.getTime());
  }
  flushCluster();

  return layout;
}

/**
 * Hour range [startHour, endHour) a week-view time grid should render.
 * Defaults to a typical 7am–7pm workday but widens to fit any booking that
 * falls outside it, so the grid doesn't clip real data.
 */
export function getHourRangeForBookings(
  bookings: { startTime: string; endTime: string }[],
  fallbackStartHour = 7,
  fallbackEndHour = 19
): { startHour: number; endHour: number } {
  let startHour = fallbackStartHour;
  let endHour = fallbackEndHour;
  for (const booking of bookings) {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    startHour = Math.min(startHour, start.getHours());
    const endHourCeil = end.getMinutes() > 0 ? end.getHours() + 1 : end.getHours();
    endHour = Math.max(endHour, endHourCeil);
  }
  return {
    startHour: Math.max(0, startHour),
    endHour: Math.min(24, Math.max(endHour, startHour + 1)),
  };
}
