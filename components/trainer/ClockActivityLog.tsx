import { Pencil } from "lucide-react";
import type {
  ClockCorrectionRequest,
  ManualSessionRequest,
  TimeClockEvent,
} from "@/lib/types";
import {
  breakDurationMs,
  groupEventsIntoSessions,
  groupSessionsByDay,
  sessionWorkedMs,
  type ClockSession,
  type ClockSessionBreak,
} from "@/lib/domain/time-clock-sessions";
import { TIME_CLOCK_EVENT_LABELS } from "@/lib/domain/clock-status";
import { displayTaskTitle } from "@/lib/domain/tasks";
import type { EnrichedTaskEntry } from "@/lib/domain/task-entry-grid";
import {
  formatDurationShort,
  formatFullDate,
  formatHours,
  formatTime,
  parseLocalDateString,
} from "@/lib/format";
import {
  ProjectDot,
  ClockCorrectionStatusTag,
  ManualSessionStatusTag,
  ManuallyLoggedTag,
} from "@/components/trainer/badges";

/** One clock in/out or break start/end event with its label, time, correction status, and a pencil icon opening the correction request form when no request is currently pending on it. */
function EventLine({
  event,
  correction,
  onRequestCorrection,
}: {
  event: TimeClockEvent;
  correction: ClockCorrectionRequest | undefined;
  onRequestCorrection: (event: TimeClockEvent) => void;
}) {
  const pending = correction?.status === "pending";

  return (
    <div className="py-0.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="w-24 shrink-0 text-brand-darkBlue/60">
          {TIME_CLOCK_EVENT_LABELS[event.type]}
        </span>
        <span className="font-medium text-brand-darkBlue">
          {formatTime(event.timestamp)}
        </span>
        {event.manuallyLogged && <ManuallyLoggedTag />}
        {correction && <ClockCorrectionStatusTag status={correction.status} />}
        {!pending && (
          <button
            type="button"
            onClick={() => onRequestCorrection(event)}
            title="Request correction"
            aria-label="Request correction"
            className="text-brand-darkBlue/40 hover:text-brand-blue"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {correction?.status === "denied" && (
        <p className="ml-24 mt-0.5 text-xs text-red-600">
          {correction.adminNote
            ? `Denied: "${correction.adminNote}"`
            : "Denied."}{" "}
          You can submit a new request.
        </p>
      )}
    </div>
  );
}

function BreakEventLines({
  brk,
  now,
  correctionsByEventId,
  onRequestCorrection,
}: {
  brk: ClockSessionBreak;
  now: Date;
  correctionsByEventId: Map<string, ClockCorrectionRequest>;
  onRequestCorrection: (event: TimeClockEvent) => void;
}) {
  return (
    <div className="rounded-md bg-brand-blueWater/40 px-2 py-1">
      <EventLine
        event={brk.start}
        correction={correctionsByEventId.get(brk.start.id)}
        onRequestCorrection={onRequestCorrection}
      />
      {brk.end && (
        <EventLine
          event={brk.end}
          correction={correctionsByEventId.get(brk.end.id)}
          onRequestCorrection={onRequestCorrection}
        />
      )}
      <p className="ml-24 text-xs text-brand-darkBlue/50">
        {formatDurationShort(breakDurationMs(brk, now))} break
      </p>
    </div>
  );
}

function SessionRow({
  session,
  now,
  correctionsByEventId,
  onRequestCorrection,
}: {
  session: ClockSession;
  now: Date;
  correctionsByEventId: Map<string, ClockCorrectionRequest>;
  onRequestCorrection: (event: TimeClockEvent) => void;
}) {
  const inProgress = session.clockOut === null;

  return (
    <div className="rounded-md border border-brand-darkBlue/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-brand-darkBlue">
          {inProgress && (
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-green" />
          )}
          {formatTime(session.clockIn.timestamp)} –{" "}
          {session.clockOut ? formatTime(session.clockOut.timestamp) : "in progress"}
        </span>
        <span className="text-sm text-brand-darkBlue/60">
          {formatDurationShort(sessionWorkedMs(session, now))} worked
        </span>
      </div>

      <div className="mt-2 space-y-0.5 border-t border-brand-darkBlue/10 pt-2">
        <EventLine
          event={session.clockIn}
          correction={correctionsByEventId.get(session.clockIn.id)}
          onRequestCorrection={onRequestCorrection}
        />
        {session.breaks.map((brk) => (
          <BreakEventLines
            key={brk.start.id}
            brk={brk}
            now={now}
            correctionsByEventId={correctionsByEventId}
            onRequestCorrection={onRequestCorrection}
          />
        ))}
        {session.clockOut && (
          <EventLine
            event={session.clockOut}
            correction={correctionsByEventId.get(session.clockOut.id)}
            onRequestCorrection={onRequestCorrection}
          />
        )}
      </div>
    </div>
  );
}

function DayTaskEntries({ entries }: { entries: EnrichedTaskEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-brand-darkBlue/50">No tasks logged this day.</p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-wrap items-center gap-2 text-sm text-brand-darkBlue/80"
        >
          {entry.project && <ProjectDot color={entry.project.color} />}
          <span className="font-medium">
            {entry.project?.name ?? "Unknown project"}
          </span>
          <span className="text-brand-darkBlue/50">·</span>
          <span>{entry.task ? displayTaskTitle(entry.task) : "Unknown task"}</span>
          <span className="text-brand-darkBlue/50">·</span>
          <span className="text-brand-darkBlue/60">{entry.office}</span>
          <span className="ml-auto shrink-0 font-medium">
            {formatHours(entry.hours)}
          </span>
          {entry.note && (
            <span className="w-full text-brand-darkBlue/50">{entry.note}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A day with a pending or denied "missed day" request but no real events yet — an approved request already has real events and renders through the normal session-grouping path above. */
function ManualSessionPlaceholderCard({
  date,
  request,
}: {
  date: string;
  request: ManualSessionRequest;
}) {
  return (
    <div className="rounded-md border border-dashed border-brand-darkBlue/20 bg-white shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-brand-darkBlue">
          {formatFullDate(parseLocalDateString(date))}
        </h3>
        <ManualSessionStatusTag status={request.status} />
      </div>
      <p className="mt-2 text-sm text-brand-darkBlue/60">
        Missed-day request: {formatTime(request.clockIn)} –{" "}
        {formatTime(request.clockOut)}
      </p>
      {request.status === "denied" && (
        <p className="mt-1 text-xs text-red-600">
          {request.adminNote
            ? `Denied: "${request.adminNote}"`
            : "Denied."}{" "}
          You can submit a new request.
        </p>
      )}
    </div>
  );
}

/**
 * Groups raw clock-in/out/break events into per-day session blocks (most
 * recent day first) and surfaces that same day's Task Tracker entries
 * alongside each one — a read-only, automatic same-date lookup, not a new
 * link between the two data models. Each individual event also gets a
 * "Request correction" action and, if a request already exists for it, a
 * status tag (pending/approved/denied). Manually-logged events are marked
 * with a "Manually logged" tag; a pending or denied "missed day" request
 * with no real events yet shows a placeholder card instead.
 */
export function ClockActivityLog({
  events,
  taskEntries,
  corrections,
  manualSessions,
  now,
  onRequestCorrection,
}: {
  events: TimeClockEvent[];
  taskEntries: EnrichedTaskEntry[];
  corrections: ClockCorrectionRequest[];
  manualSessions: ManualSessionRequest[];
  now: Date;
  onRequestCorrection: (event: TimeClockEvent) => void;
}) {
  const dayGroups = groupSessionsByDay(groupEventsIntoSessions(events));

  // Latest (most recently created) manual session request per date — a
  // fresh denied-then-resubmitted request shouldn't stay hidden behind an
  // earlier one for the same date.
  const latestManualByDate = new Map<string, ManualSessionRequest>();
  for (const request of [...manualSessions].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )) {
    latestManualByDate.set(request.date, request);
  }

  const dayGroupDates = new Set(dayGroups.map((group) => group.date));
  const placeholders = [...latestManualByDate.entries()].filter(
    ([date, request]) => request.status !== "approved" && !dayGroupDates.has(date)
  );

  if (dayGroups.length === 0 && placeholders.length === 0) {
    return (
      <p className="mt-3 text-sm text-brand-darkBlue/60">
        No time clock activity yet.
      </p>
    );
  }

  const entriesByDate = new Map<string, EnrichedTaskEntry[]>();
  for (const entry of taskEntries) {
    const bucket = entriesByDate.get(entry.date);
    if (bucket) bucket.push(entry);
    else entriesByDate.set(entry.date, [entry]);
  }

  // Latest (most recently created) request per event — a denied request
  // shouldn't keep hiding behind an earlier approved/denied one for the
  // same event.
  const correctionsByEventId = new Map<string, ClockCorrectionRequest>();
  for (const correction of [...corrections].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )) {
    correctionsByEventId.set(correction.originalEventId, correction);
  }

  const dates = [...dayGroupDates, ...placeholders.map(([date]) => date)].sort(
    (a, b) => b.localeCompare(a)
  );
  const dayGroupsByDate = new Map(dayGroups.map((group) => [group.date, group]));
  const placeholdersByDate = new Map(placeholders);

  return (
    <div className="mt-3 space-y-4">
      {dates.map((date) => {
        const group = dayGroupsByDate.get(date);
        if (!group) {
          const request = placeholdersByDate.get(date);
          if (!request) return null;
          return (
            <ManualSessionPlaceholderCard key={date} date={date} request={request} />
          );
        }

        return (
          <div
            key={date}
            className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4"
          >
            <h3 className="text-sm font-semibold text-brand-darkBlue">
              {formatFullDate(parseLocalDateString(date))}
            </h3>

            <div className="mt-3 space-y-2">
              {group.sessions.map((session) => (
                <SessionRow
                  key={session.clockIn.id}
                  session={session}
                  now={now}
                  correctionsByEventId={correctionsByEventId}
                  onRequestCorrection={onRequestCorrection}
                />
              ))}
            </div>

            <div className="mt-3 border-t border-brand-darkBlue/10 pt-3">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-brand-darkBlue/40">
                Task entries
              </p>
              <DayTaskEntries entries={entriesByDate.get(date) ?? []} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
