"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Coffee, LogOut, Moon, Pause, Sun } from "lucide-react";
import type {
  ClockCorrectionRequest,
  ManualSessionRequest,
  TimeClockEvent,
  TimeClockEventType,
  TimesheetSubmission,
} from "@/lib/types";
import type { ClockStatus } from "@/lib/domain/clock-status";
import {
  computeWorkedMs,
  msToHours,
  startOfDay,
} from "@/lib/domain/worked-hours";
import { formatDurationShort, toLocalDateString } from "@/lib/format";
import { useToast } from "@/components/ToastProvider";
import { ClockActivityLog } from "@/components/trainer/ClockActivityLog";
import { RequestClockCorrectionModal } from "@/components/trainer/RequestClockCorrectionModal";
import { LogMissedDayModal } from "@/components/trainer/LogMissedDayModal";
import type { EnrichedTaskEntry } from "@/lib/domain/task-entry-grid";
import {
  computeWeekLockState,
  findTimesheetWeekSubmission,
  formatWeekLabel,
  weekStartDateFor,
} from "@/lib/domain/timesheet-submissions";

const STATUS_DISPLAY: Record<
  ClockStatus,
  { label: string; className: string }
> = {
  clocked_in: { label: "Clocked in", className: "bg-brand-green/10 text-brand-green" },
  on_break: { label: "On break", className: "bg-brand-orange/10 text-brand-orange" },
  clocked_out: { label: "Clocked out", className: "bg-brand-blueWater text-brand-darkBlue/70" },
};

function mostRecent(
  events: TimeClockEvent[],
  type: TimeClockEventType
): TimeClockEvent | null {
  return (
    [...events]
      .filter((e) => e.type === type)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .at(-1) ?? null
  );
}

export default function TimeClockPage() {
  const [status, setStatus] = useState<ClockStatus>("clocked_out");
  const [events, setEvents] = useState<TimeClockEvent[]>([]);
  const [taskEntries, setTaskEntries] = useState<EnrichedTaskEntry[]>([]);
  const [corrections, setCorrections] = useState<ClockCorrectionRequest[]>([]);
  const [manualSessions, setManualSessions] = useState<ManualSessionRequest[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [correctionTarget, setCorrectionTarget] =
    useState<TimeClockEvent | null>(null);
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [showLogMissedDay, setShowLogMissedDay] = useState(false);
  const [manualSessionSubmitting, setManualSessionSubmitting] =
    useState(false);
  const [timesheetSubmissions, setTimesheetSubmissions] = useState<
    TimesheetSubmission[]
  >([]);
  const [submittingTimesheet, setSubmittingTimesheet] = useState(false);
  const { showToast } = useToast();

  async function load(): Promise<TimeClockEvent[]> {
    setLoading(true);
    const response = await fetch("/api/trainer/time-clock");
    const data = await response.json();
    const freshEvents: TimeClockEvent[] = data.events ?? [];
    setStatus(data.status ?? "clocked_out");
    setEvents(freshEvents);
    setLoading(false);
    return freshEvents;
  }

  // Read-only, same-day lookup surfaced next to each session block — not a
  // new link between the two data models, so a plain one-time fetch is
  // enough (no need to re-fetch on every clock event).
  async function loadTaskEntries() {
    const response = await fetch("/api/trainer/task-entries");
    const data = await response.json();
    setTaskEntries(data.entries ?? []);
  }

  async function loadCorrections() {
    const response = await fetch("/api/trainer/clock-corrections");
    const data = await response.json();
    setCorrections(data.requests ?? []);
  }

  async function loadManualSessions() {
    const response = await fetch("/api/trainer/manual-sessions");
    const data = await response.json();
    setManualSessions(data.requests ?? []);
  }

  async function loadTimesheetSubmissions() {
    const response = await fetch("/api/trainer/timesheet-submissions");
    const data = await response.json();
    setTimesheetSubmissions(data.submissions ?? []);
  }

  useEffect(() => {
    load();
    loadTaskEntries();
    loadCorrections();
    loadManualSessions();
    loadTimesheetSubmissions();
  }, []);

  async function submitCorrection(requestedTimestampIso: string, reason: string) {
    if (!correctionTarget) return;
    setCorrectionSubmitting(true);
    try {
      const response = await fetch("/api/trainer/clock-corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: correctionTarget.id,
          requestedTimestamp: requestedTimestampIso,
          reason,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to submit correction request.");
        return;
      }

      setCorrectionTarget(null);
      await loadCorrections();
      showToast({ message: "Correction requested" });
    } finally {
      setCorrectionSubmitting(false);
    }
  }

  async function submitManualSession(input: {
    date: string;
    clockIn: string;
    clockOut: string;
    breaks: { start: string; end: string }[];
    reason: string;
  }) {
    setManualSessionSubmitting(true);
    try {
      const response = await fetch("/api/trainer/manual-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to submit manual session request.");
        return;
      }

      setShowLogMissedDay(false);
      await loadManualSessions();
      showToast({ message: "Missed day submitted for review" });
    } finally {
      setManualSessionSubmitting(false);
    }
  }

  async function handleSubmitTimesheet() {
    setSubmittingTimesheet(true);
    try {
      const response = await fetch("/api/trainer/timesheet-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStartDate: currentWeekStart }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to submit timesheet.");
        return;
      }

      setError(null);
      await loadTimesheetSubmissions();
      showToast({ message: "Timesheet submitted." });
    } finally {
      setSubmittingTimesheet(false);
    }
  }

  // Ticks once a second while there's a live timer on screen (clocked in or
  // on break); idle the rest of the time so a clocked-out trainer isn't
  // re-rendering this page for nothing.
  useEffect(() => {
    if (status === "clocked_out") return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [status]);

  async function logEvent(type: TimeClockEventType) {
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/trainer/time-clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to log event.");
        return;
      }

      const freshEvents = await load();

      if (type === "clock_out") {
        const clockedNow = new Date();
        const hoursToday = msToHours(
          computeWorkedMs(freshEvents, startOfDay(clockedNow), clockedNow, clockedNow)
        );
        showToast({
          message: `Nice work — ${hoursToday.toFixed(1)} hours logged today.`,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const display = STATUS_DISPLAY[status];
  const isEvening = now.getHours() >= 18 || now.getHours() < 6;
  const ClockInIcon = isEvening ? Moon : Sun;

  const lastClockIn = mostRecent(events, "clock_in");
  const lastBreakStart = mostRecent(events, "break_start");

  const shiftElapsedMs =
    status === "clocked_in" && lastClockIn
      ? computeWorkedMs(events, new Date(lastClockIn.timestamp), now, now)
      : 0;
  const breakElapsedMs =
    status === "on_break" && lastBreakStart
      ? now.getTime() - new Date(lastBreakStart.timestamp).getTime()
      : 0;

  const currentWeekStart = weekStartDateFor(toLocalDateString(now));
  const currentTimesheetSubmission = findTimesheetWeekSubmission(
    timesheetSubmissions,
    currentWeekStart
  );
  const timesheetLockState = computeWeekLockState(currentTimesheetSubmission);
  const timesheetStatus = currentTimesheetSubmission?.status ?? "draft";
  const canSubmitTimesheet =
    timesheetStatus === "draft" || timesheetStatus === "rejected";
  const timesheetLocked = timesheetLockState === "locked";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Time clock</h1>

      <section className="mt-6 rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6">
        <p className="text-sm text-brand-darkBlue/60">Current status</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${display.className}`}
          >
            {status === "clocked_in" && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-green" />
            )}
            {loading ? "Loading…" : display.label}
          </span>

          {status === "clocked_in" && shiftElapsedMs > 0 && (
            <span className="text-sm text-brand-darkBlue/60">
              {formatDurationShort(shiftElapsedMs)} and counting
            </span>
          )}
          {status === "on_break" && (
            <span className="text-sm text-brand-orange">
              On break — {formatDurationShort(breakElapsedMs)}
            </span>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          {status === "clocked_out" && (
            <button
              onClick={() => logEvent("clock_in")}
              disabled={submitting || loading || timesheetLocked}
              className="flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
            >
              <ClockInIcon className="h-4 w-4" />
              Clock in
            </button>
          )}

          {status === "clocked_in" && (
            <>
              <button
                onClick={() => logEvent("break_start")}
                disabled={submitting || loading || timesheetLocked}
                className="flex items-center gap-2 rounded-md border border-brand-darkBlue/20 px-4 py-2 text-sm font-medium hover:bg-brand-blueWater disabled:opacity-50"
              >
                <Coffee className="h-4 w-4" />
                Start break
              </button>
              <button
                onClick={() => logEvent("clock_out")}
                disabled={submitting || loading || timesheetLocked}
                className="flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                Clock out
              </button>
            </>
          )}

          {status === "on_break" && (
            <button
              onClick={() => logEvent("break_end")}
              disabled={submitting || loading || timesheetLocked}
              className="flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
            >
              <Pause className="h-4 w-4" />
              End break
            </button>
          )}
        </div>

        <div className="mt-6 border-t border-brand-darkBlue/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-brand-darkBlue/60">
              This week ({formatWeekLabel(currentWeekStart)})
            </p>
            {canSubmitTimesheet && (
              <button
                type="button"
                onClick={handleSubmitTimesheet}
                disabled={submittingTimesheet}
                className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
              >
                {submittingTimesheet
                  ? "Submitting…"
                  : timesheetStatus === "rejected"
                    ? "Resubmit timesheet"
                    : "Submit timesheet"}
              </button>
            )}
          </div>

          {timesheetStatus === "submitted" && (
            <p className="mt-3 rounded-md border border-brand-orange/30 bg-brand-orange/10 p-3 text-sm text-brand-orange">
              Submitted — awaiting review.
            </p>
          )}
          {timesheetStatus === "approved" && (
            <p className="mt-3 rounded-md border border-brand-green/30 bg-brand-green/10 p-3 text-sm text-brand-green">
              Approved.
            </p>
          )}
          {timesheetStatus === "rejected" && currentTimesheetSubmission && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Rejected: {currentTimesheetSubmission.rejectionReason} — please
              revise and resubmit.
            </p>
          )}
          {timesheetLocked && (
            <p className="mt-3 text-xs text-brand-darkBlue/50">
              This week is locked — use a correction request to change
              already-logged time.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Activity log</h2>
          <button
            type="button"
            onClick={() => setShowLogMissedDay(true)}
            disabled={timesheetLocked}
            className="flex items-center gap-2 rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm font-medium hover:bg-brand-blueWater disabled:opacity-50"
          >
            <CalendarPlus className="h-4 w-4" />
            Log a missed day
          </button>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-brand-darkBlue/60">Loading…</p>
        ) : (
          <ClockActivityLog
            events={events}
            taskEntries={taskEntries}
            corrections={corrections}
            manualSessions={manualSessions}
            now={now}
            onRequestCorrection={setCorrectionTarget}
          />
        )}
      </section>

      <RequestClockCorrectionModal
        open={correctionTarget !== null}
        onClose={() => setCorrectionTarget(null)}
        originalTimestamp={correctionTarget?.timestamp ?? new Date().toISOString()}
        submitting={correctionSubmitting}
        onConfirm={submitCorrection}
      />

      <LogMissedDayModal
        open={showLogMissedDay}
        onClose={() => setShowLogMissedDay(false)}
        submitting={manualSessionSubmitting}
        onConfirm={submitManualSession}
      />
    </div>
  );
}
