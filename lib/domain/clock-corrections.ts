import type {
  ClockCorrectionRequest,
  PublicUser,
  TimeClockEvent,
  TimeClockEventType,
} from "@/lib/types";

export type EnrichedClockCorrectionRequest = ClockCorrectionRequest & {
  trainer: PublicUser | null;
  /** Looked up from `originalEventId` at enrich time rather than stored on the request, so the schema stays exactly what was asked for. */
  eventType: TimeClockEventType | null;
};

/**
 * Joins each correction request to its trainer and the original event's
 * type — shared by the admin review queue and the per-trainer Timesheet
 * tab so neither reimplements the lookup.
 */
export function enrichClockCorrectionRequests(
  requests: ClockCorrectionRequest[],
  trainers: PublicUser[],
  allEvents: TimeClockEvent[]
): EnrichedClockCorrectionRequest[] {
  const trainersById = new Map(trainers.map((t) => [t.id, t]));
  const eventsById = new Map(allEvents.map((e) => [e.id, e]));

  return requests.map((request) => ({
    ...request,
    trainer: trainersById.get(request.trainerId) ?? null,
    eventType: eventsById.get(request.originalEventId)?.type ?? null,
  }));
}
