"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDateTime, formatDurationShort } from "@/lib/format";
import type { EnrichedManualSessionRequest } from "@/lib/domain/manual-sessions";

/** Central review queue — every trainer's currently "pending" missed-day requests, with Approve/Deny actions. Denying accepts an optional note. Approving creates the underlying TimeClockEvents. */
export function ManualSessionRequestsList({
  initialRequests,
}: {
  initialRequests: EnrichedManualSessionRequest[];
}) {
  const [requests, setRequests] = useState(initialRequests);

  async function refresh() {
    const response = await fetch("/api/admin/manual-sessions");
    const data = await response.json();
    setRequests(data.requests ?? []);
  }

  if (requests.length === 0) {
    return (
      <p className="text-sm text-brand-darkBlue/60">
        No missed-day requests awaiting review.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <ManualSessionCard
          key={request.id}
          request={request}
          onDecided={refresh}
        />
      ))}
    </ul>
  );
}

function ManualSessionCard({
  request,
  onDecided,
}: {
  request: EnrichedManualSessionRequest;
  onDecided: () => void;
}) {
  const [denying, setDenying] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "deny") {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/manual-sessions/${request.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "deny" ? { action, adminNote } : { action }
          ),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to update request.");
        return;
      }

      setDenying(false);
      onDecided();
    } finally {
      setSubmitting(false);
    }
  }

  const workedMs =
    new Date(request.clockOut).getTime() - new Date(request.clockIn).getTime();

  return (
    <li className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/admin/trainers/${request.trainerId}`}
            className="text-sm font-medium text-brand-blue hover:underline"
          >
            {request.trainer?.name ?? "Unknown trainer"}
          </Link>
          <p className="mt-1 text-sm text-brand-darkBlue">
            {request.date} — {formatDurationShort(workedMs)} logged
          </p>
          <p className="mt-1 text-sm text-brand-darkBlue/60">
            {formatDateTime(request.clockIn)} →{" "}
            {formatDateTime(request.clockOut)}
          </p>
          {request.breaks.length > 0 && (
            <p className="mt-1 text-sm text-brand-darkBlue/60">
              {request.breaks.length} break
              {request.breaks.length > 1 ? "s" : ""}:{" "}
              {request.breaks
                .map(
                  (brk) =>
                    `${formatDateTime(brk.start)} – ${formatDateTime(brk.end)}`
                )
                .join(", ")}
            </p>
          )}
          <p className="mt-2 text-sm text-brand-darkBlue/70">
            “{request.reason}”
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        {!denying ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => decide("approve")}
              disabled={submitting}
              className="rounded-md bg-brand-green px-3 py-1 text-sm font-medium text-white hover:bg-brand-green/90 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setDenying(true)}
              disabled={submitting}
              className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-sm hover:bg-brand-blueWater"
            >
              Deny
            </button>
          </div>
        ) : (
          <div className="w-56 shrink-0">
            <textarea
              rows={2}
              placeholder="Note (optional)"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="block w-full rounded-md border border-brand-darkBlue/20 px-2 py-1 text-xs shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => decide("deny")}
                disabled={submitting}
                className="rounded-md bg-brand-blue px-3 py-1 text-xs font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
              >
                {submitting ? "Denying…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setDenying(false)}
                className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-xs hover:bg-brand-blueWater"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
