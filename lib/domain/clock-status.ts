import type { TimeClockEvent, TimeClockEventType } from "@/lib/types";

export type ClockStatus = "clocked_out" | "clocked_in" | "on_break";

/** Derives the trainer's current status from their full event history. */
export function computeClockStatus(events: TimeClockEvent[]): ClockStatus {
  const last = [...events].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  ).at(-1);

  if (!last) return "clocked_out";

  switch (last.type) {
    case "clock_in":
    case "break_end":
      return "clocked_in";
    case "break_start":
      return "on_break";
    case "clock_out":
      return "clocked_out";
  }
}

/** The only event types that are a valid next action from a given status. */
export function nextAllowedEventTypes(
  status: ClockStatus
): TimeClockEventType[] {
  switch (status) {
    case "clocked_out":
      return ["clock_in"];
    case "clocked_in":
      return ["break_start", "clock_out"];
    case "on_break":
      return ["break_end"];
  }
}

export const TIME_CLOCK_EVENT_LABELS: Record<TimeClockEventType, string> = {
  clock_in: "Clocked in",
  clock_out: "Clocked out",
  break_start: "Started break",
  break_end: "Ended break",
};
