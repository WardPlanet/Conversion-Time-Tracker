"use client";

import { useState } from "react";
import Link from "next/link";
import type { Flag } from "@/lib/types";
import type { EnrichedFlag } from "@/lib/domain/flags";

const FLAG_TYPE_LABELS: Record<Flag["type"], string> = {
  accepted_booking_no_hours: "No hours logged for an accepted booking",
  unsubmitted_task_tracker: "Unsubmitted task tracker",
  pending_booking_unanswered: "Pending booking unanswered",
  trainer_inactive: "Trainer inactive",
  cancellation_requested: "Booking cancellation requested",
};

function FlagSeverityTag({ severity }: { severity: Flag["severity"] }) {
  return severity === "warning" ? (
    <span className="inline-flex items-center rounded-full bg-brand-orange/10 px-2.5 py-0.5 text-xs font-medium text-brand-orange">
      Warning
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-brand-blueWater px-2.5 py-0.5 text-xs font-medium text-brand-darkBlue">
      Info
    </span>
  );
}

/**
 * Renders a list of flags with a Dismiss action, reused by both the admin
 * Dashboard's Flags section (all trainers, `compact` — one condensed row per
 * flag, styled like the dashboard's other list sections) and a trainer
 * profile's Flags tab (scoped to `trainerId`, the plain full-detail list).
 * Each caller supplies its own SSR'd `initialFlags`; dismissing refetches
 * from the same /api/admin/flags endpoint and re-filters here so neither
 * caller reimplements the fetch/enrich logic.
 */
export function FlagsList({
  initialFlags,
  trainerId,
  showTrainerLink = true,
  compact = false,
}: {
  initialFlags: EnrichedFlag[];
  trainerId?: string;
  showTrainerLink?: boolean;
  compact?: boolean;
}) {
  const [flags, setFlags] = useState(initialFlags);
  const [showMore, setShowMore] = useState(false);

  async function refresh() {
    const response = await fetch("/api/admin/flags");
    const data = await response.json();
    const all: EnrichedFlag[] = data.flags ?? [];
    setFlags(trainerId ? all.filter((f) => f.trainerId === trainerId) : all);
  }

  async function dismissAll() {
    await fetch("/api/admin/flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    await refresh();
  }

  if (!compact) {
    if (flags.length === 0) {
      return <p className="text-sm text-brand-darkBlue/60">No active flags.</p>;
    }
    return (
      <ul className="space-y-3">
        {flags.map((flag) => (
          <FlagCard
            key={flag.id}
            flag={flag}
            showTrainerLink={showTrainerLink}
            onDismissed={refresh}
          />
        ))}
      </ul>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium">
        Flags
        {flags.length > 0 && (
          <span className="ml-1.5 text-sm font-normal text-brand-darkBlue/50">
            ({flags.length})
          </span>
        )}
      </h2>

      <div className="mt-3">
        {flags.length === 0 ? (
          <p className="text-sm text-brand-darkBlue/60">No flags right now.</p>
        ) : (
          <div className="space-y-2">
            <ul className="space-y-2">
              <CompactFlagRow
                key={flags[0].id}
                flag={flags[0]}
                showTrainerLink={showTrainerLink}
                onDismissed={refresh}
              />
              {showMore &&
                flags.slice(1).map((flag) => (
                  <CompactFlagRow
                    key={flag.id}
                    flag={flag}
                    showTrainerLink={showTrainerLink}
                    onDismissed={refresh}
                  />
                ))}
            </ul>
            {flags.length > 1 && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowMore((v) => !v)}
                  aria-expanded={showMore}
                  className="text-sm font-medium text-brand-blue hover:underline"
                >
                  {showMore ? "Show less" : `See more (${flags.length - 1})`}
                </button>
                {showMore && (
                  <DismissAllControl
                    count={flags.length}
                    onConfirm={dismissAll}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Header-level bulk action — a lightweight inline confirm (not a modal) before dismissing every active flag at once. */
function DismissAllControl({
  count,
  onConfirm,
}: {
  count: number;
  onConfirm: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-brand-darkBlue/60">Dismiss all {count}?</span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="font-medium text-brand-blue hover:underline disabled:opacity-50"
        >
          {submitting ? "Dismissing…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={submitting}
          className="text-brand-darkBlue/60 hover:underline disabled:opacity-50"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-sm font-medium text-brand-blue hover:underline"
    >
      Dismiss all
    </button>
  );
}

/** One condensed row (severity + trainer + message, Dismiss inline) — the Dashboard's density-matched alternative to {@link FlagCard}'s full-detail layout. */
function CompactFlagRow({
  flag,
  showTrainerLink,
  onDismissed,
}: {
  flag: EnrichedFlag;
  showTrainerLink: boolean;
  onDismissed: () => void;
}) {
  const [dismissing, setDismissing] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmDismiss() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/flags/${flag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "dismissed",
          note: note.trim() || undefined,
        }),
      });
      if (response.ok) {
        setDismissing(false);
        onDismissed();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm px-4 py-2.5">
      <div className="flex items-center gap-3">
        <FlagSeverityTag severity={flag.severity} />
        {showTrainerLink && (
          <Link
            href={`/admin/trainers/${flag.trainerId}`}
            className="shrink-0 truncate text-sm font-medium text-brand-blue hover:underline"
          >
            {flag.trainer?.name ?? "Unknown trainer"}
          </Link>
        )}
        <span
          className="min-w-0 flex-1 truncate text-sm text-brand-darkBlue/70"
          title={flag.message}
        >
          {flag.message}
        </span>
        {!dismissing && (
          <button
            type="button"
            onClick={() => setDismissing(true)}
            className="shrink-0 rounded-md border border-brand-darkBlue/20 px-2.5 py-1 text-xs hover:bg-brand-blueWater"
          >
            Dismiss
          </button>
        )}
      </div>

      {dismissing && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-brand-darkBlue/20 px-2 py-1 text-xs shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <button
            type="button"
            onClick={handleConfirmDismiss}
            disabled={submitting}
            className="shrink-0 rounded-md bg-brand-blue px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
          >
            {submitting ? "Dismissing…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setDismissing(false)}
            className="shrink-0 rounded-md border border-brand-darkBlue/20 px-2.5 py-1 text-xs hover:bg-brand-blueWater"
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}

function FlagCard({
  flag,
  showTrainerLink,
  onDismissed,
}: {
  flag: EnrichedFlag;
  showTrainerLink: boolean;
  onDismissed: () => void;
}) {
  return (
    <li className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4">
      <FlagCardContent
        flag={flag}
        showTrainerLink={showTrainerLink}
        onDismissed={onDismissed}
      />
    </li>
  );
}

function FlagCardContent({
  flag,
  showTrainerLink,
  onDismissed,
}: {
  flag: EnrichedFlag;
  showTrainerLink: boolean;
  onDismissed: () => void;
}) {
  const [dismissing, setDismissing] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmDismiss() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/flags/${flag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "dismissed",
          note: note.trim() || undefined,
        }),
      });
      if (response.ok) {
        setDismissing(false);
        onDismissed();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <FlagSeverityTag severity={flag.severity} />
          <span className="text-xs text-brand-darkBlue/50">
            {FLAG_TYPE_LABELS[flag.type]}
          </span>
        </div>

        {showTrainerLink && (
          <Link
            href={`/admin/trainers/${flag.trainerId}`}
            className="mt-1.5 block text-sm font-medium text-brand-blue hover:underline"
          >
            {flag.trainer?.name ?? "Unknown trainer"}
          </Link>
        )}

        <p className="mt-1 text-sm text-brand-darkBlue">{flag.message}</p>

        {(flag.relatedProject || flag.relatedBooking) && (
          <p className="mt-1 text-xs text-brand-darkBlue/50">
            {flag.relatedProject && `Project: ${flag.relatedProject.name}`}
            {flag.relatedProject && flag.relatedBooking && " · "}
            {flag.relatedBooking && `Booking: ${flag.relatedBooking.title}`}
          </p>
        )}
      </div>

      {!dismissing ? (
        <button
          type="button"
          onClick={() => setDismissing(true)}
          className="shrink-0 rounded-md border border-brand-darkBlue/20 px-3 py-1 text-sm hover:bg-brand-blueWater"
        >
          Dismiss
        </button>
      ) : (
        <div className="w-56 shrink-0">
          <textarea
            rows={2}
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="block w-full rounded-md border border-brand-darkBlue/20 px-2 py-1 text-xs shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={handleConfirmDismiss}
              disabled={submitting}
              className="rounded-md bg-brand-blue px-3 py-1 text-xs font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
            >
              {submitting ? "Dismissing…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setDismissing(false)}
              className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-xs hover:bg-brand-blueWater"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
