import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { store } from "@/lib/data";
import {
  computeDailyHours,
  computeWorkedMs,
  msToHours,
  startOfMonth,
  startOfWeek,
} from "@/lib/domain/worked-hours";
import { TIME_CLOCK_EVENT_LABELS } from "@/lib/domain/clock-status";
import {
  ClockCorrectionStatusTag,
  ManualSessionStatusTag,
  ManuallyLoggedTag,
} from "@/components/trainer/badges";
import { ExportTimesheetButton } from "@/components/admin/ExportTimesheetButton";
import { TimesheetSubmissionStatusTag } from "@/components/trainer/badges";
import { enrichTimesheetSubmissions } from "@/lib/domain/timesheet-submissions";
import type { ClockCorrectionRequest } from "@/lib/types";
import {
  formatDateTime,
  formatHours,
  parseLocalDateString,
  toLocalDateString,
} from "@/lib/format";

export default async function TrainerTimesheetTab({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string; to?: string };
}) {
  const session = await getSession();
  if (!session) notFound();
  const actor = { id: session.userId, role: session.role };

  const [trainer, events, corrections, manualSessions, timesheetSubmissions] =
    await Promise.all([
      store.getUserById(params.id),
      store.listTimeClockEvents(params.id),
      store.listClockCorrectionRequestsForTrainer(params.id, actor),
      store.listManualSessionRequestsForTrainer(params.id, actor),
      store.listTimesheetSubmissionsForTrainer(params.id, actor),
    ]);
  if (!trainer || trainer.role !== "trainer") notFound();

  const enrichedTimesheetSubmissions = enrichTimesheetSubmissions(
    timesheetSubmissions,
    [trainer],
    events
  ).sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));

  // Latest (most recently created) request per event, so an earlier
  // approved/denied request for the same event never hides a fresher one.
  const correctionsByEventId = new Map<string, ClockCorrectionRequest>();
  for (const correction of [...corrections].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )) {
    correctionsByEventId.set(correction.originalEventId, correction);
  }

  const now = new Date();
  const from = searchParams.from
    ? parseLocalDateString(searchParams.from)
    : startOfMonth(now);
  const to = searchParams.to ? parseLocalDateString(searchParams.to) : now;

  // An explicit "to" date is a calendar day the admin wants included in
  // full, so the exclusive range boundary needs to land the day after it.
  const rangeEnd = new Date(to);
  if (searchParams.to) rangeEnd.setDate(rangeEnd.getDate() + 1);

  const totalMs = computeWorkedMs(events, from, rangeEnd, now);
  const dailyHours = computeDailyHours(events, from, rangeEnd, now);

  const fromMs = from.getTime();
  const rangeEndMs = rangeEnd.getTime();
  const eventsInRange = events
    .filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= fromMs && t < rangeEndMs;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Export always covers the current Monday–Sunday business week,
  // independent of whichever range is selected above.
  const exportWeekStart = startOfWeek(now);
  const exportWeekEnd = new Date(exportWeekStart);
  exportWeekEnd.setDate(exportWeekEnd.getDate() + 6);
  const exportRangeEnd = new Date(exportWeekEnd);
  exportRangeEnd.setDate(exportRangeEnd.getDate() + 1);

  const exportWeekStartMs = exportWeekStart.getTime();
  const exportRangeEndMs = exportRangeEnd.getTime();
  const eventsThisWeek = events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return t >= exportWeekStartMs && t < exportRangeEndMs;
  });

  return (
    <div>
      <section className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Timesheet</h2>
          <ExportTimesheetButton
            trainerName={trainer.name}
            from={toLocalDateString(exportWeekStart)}
            to={toLocalDateString(exportWeekEnd)}
            events={eventsThisWeek}
          />
        </div>
        <form
          method="get"
          className="mt-4 flex flex-wrap items-end gap-4"
        >
          <label className="block">
            <span className="block text-xs font-medium text-brand-darkBlue/60">
              From
            </span>
            <input
              type="date"
              name="from"
              defaultValue={toLocalDateString(from)}
              className="mt-1 rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-brand-darkBlue/60">
              To
            </span>
            <input
              type="date"
              name="to"
              defaultValue={toLocalDateString(to)}
              className="mt-1 rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
          >
            Update range
          </button>
        </form>

        <p className="mt-4 text-sm text-brand-darkBlue/60">Total hours in range</p>
        <p className="text-2xl font-semibold">
          {formatHours(msToHours(totalMs))}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Timesheet submissions</h2>
        {enrichedTimesheetSubmissions.length === 0 ? (
          <p className="mt-3 text-sm text-brand-darkBlue/60">
            No timesheet submissions yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {enrichedTimesheetSubmissions.map((submission) => (
              <li
                key={submission.id}
                className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    Week of {submission.weekLabel}
                    <TimesheetSubmissionStatusTag status={submission.status} />
                  </span>
                  <span className="text-sm text-brand-darkBlue/60">
                    {formatHours(submission.totalHours)}
                  </span>
                </div>
                {submission.status === "rejected" &&
                  submission.rejectionReason && (
                    <p className="mt-1 text-xs text-red-600">
                      Rejected: {submission.rejectionReason}
                    </p>
                  )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Daily hours</h2>
        <ul className="mt-3 space-y-1">
          {dailyHours.map((d) => (
            <li
              key={d.date}
              className="flex items-center justify-between rounded-md border border-brand-darkBlue/10 bg-white shadow-sm px-3 py-2 text-sm"
            >
              <span>{d.date}</span>
              <span className="font-medium">{formatHours(d.hours)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Activity log</h2>
        {eventsInRange.length === 0 ? (
          <p className="mt-3 text-sm text-brand-darkBlue/60">
            No time clock activity in this range.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {eventsInRange.map((event) => {
              const correction = correctionsByEventId.get(event.id);
              return (
                <li
                  key={event.id}
                  className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {TIME_CLOCK_EVENT_LABELS[event.type]}
                      {event.manuallyLogged && <ManuallyLoggedTag />}
                      {correction && (
                        <ClockCorrectionStatusTag status={correction.status} />
                      )}
                    </span>
                    <span className="text-sm text-brand-darkBlue/60">
                      {formatDateTime(event.timestamp)}
                    </span>
                  </div>
                  {correction?.status === "denied" && (
                    <p className="mt-1 text-xs text-red-600">
                      Requested {formatDateTime(correction.requestedTimestamp)}
                      {correction.adminNote &&
                        ` — Denied: "${correction.adminNote}"`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Missed-day requests</h2>
        {manualSessions.length === 0 ? (
          <p className="mt-3 text-sm text-brand-darkBlue/60">
            No missed-day requests from this trainer.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {manualSessions.map((request) => (
              <li
                key={request.id}
                className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {request.date}
                    <ManualSessionStatusTag status={request.status} />
                  </span>
                  <span className="text-sm text-brand-darkBlue/60">
                    {formatDateTime(request.clockIn)} –{" "}
                    {formatDateTime(request.clockOut)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-brand-darkBlue/70">
                  “{request.reason}”
                </p>
                {request.status === "denied" && request.adminNote && (
                  <p className="mt-1 text-xs text-red-600">
                    Denied: "{request.adminNote}"
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
