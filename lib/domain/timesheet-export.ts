import type { TimeClockEvent, TimeClockEventType } from "@/lib/types";
import { formatTime, toLocalDateString } from "@/lib/format";

/** Export-facing labels — distinct from TIME_CLOCK_EVENT_LABELS, which are past-tense strings meant for on-screen activity logs. */
export const TIME_CLOCK_EVENT_EXPORT_LABELS: Record<TimeClockEventType, string> = {
  clock_in: "Clock In",
  clock_out: "Clock Out",
  break_start: "Break Start",
  break_end: "Break End",
};

export interface TimesheetExportRow {
  Date: string;
  "Event Type": string;
  Time: string;
}

/** One row per raw event, oldest first — no computed totals yet. */
export function buildTimesheetExportRows(
  events: TimeClockEvent[]
): TimesheetExportRow[] {
  return [...events]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((event) => ({
      Date: toLocalDateString(new Date(event.timestamp)),
      "Event Type": TIME_CLOCK_EVENT_EXPORT_LABELS[event.type],
      Time: formatTime(event.timestamp),
    }));
}
