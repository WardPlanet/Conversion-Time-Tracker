import type { ManualSessionRequest, PublicUser } from "@/lib/types";

export type EnrichedManualSessionRequest = ManualSessionRequest & {
  trainer: PublicUser | null;
};

/**
 * Joins each manual session request to its trainer — shared by the admin
 * review queue and the per-trainer Timesheet tab so neither reimplements
 * the lookup.
 */
export function enrichManualSessionRequests(
  requests: ManualSessionRequest[],
  trainers: PublicUser[]
): EnrichedManualSessionRequest[] {
  const trainersById = new Map(trainers.map((t) => [t.id, t]));

  return requests.map((request) => ({
    ...request,
    trainer: trainersById.get(request.trainerId) ?? null,
  }));
}
