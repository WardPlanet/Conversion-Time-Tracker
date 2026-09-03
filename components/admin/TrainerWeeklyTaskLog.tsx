"use client";

import { useState } from "react";
import { CalendarNav } from "@/components/calendar/CalendarNav";
import { WeeklyTaskGrid } from "@/components/task-tracker/WeeklyTaskGrid";
import { WeeklySubmissionStatusTag } from "@/components/trainer/badges";
import {
  filterEntriesForWeek,
  getBusinessWeekDays,
  nextBusinessWeek,
  previousBusinessWeek,
  type EnrichedTaskEntry,
} from "@/lib/domain/task-entry-grid";
import { findWeekSubmission } from "@/lib/domain/weekly-submissions";
import { toLocalDateString } from "@/lib/format";
import type { Project, WeeklySubmission } from "@/lib/types";

/**
 * Admin-side counterpart to the trainer's own Task Tracker grid — same data,
 * same grouping, read-only. Rows are driven by what's actually logged for
 * the selected week, not the trainer's full project list, so `projects`
 * should be passed in unfiltered and the per-week row set is derived here.
 * Also shows that week's submission status, so an admin reviewing this
 * trainer can see it here without a trip to the Submissions queue.
 */
export function TrainerWeeklyTaskLog({
  projects,
  entries,
  submissions,
}: {
  projects: Project[];
  entries: EnrichedTaskEntry[];
  submissions: WeeklySubmission[];
}) {
  const [weekCursor, setWeekCursor] = useState(() => new Date());
  const weekdays = getBusinessWeekDays(weekCursor);
  const entriesThisWeek = filterEntriesForWeek(entries, weekdays);
  const loggedProjectIds = new Set(entriesThisWeek.map((e) => e.projectId));
  const gridProjects = projects.filter((p) => loggedProjectIds.has(p.id));

  const weekStart = toLocalDateString(weekdays[0]);
  const submission = findWeekSubmission(submissions, weekStart);
  const status = submission?.status ?? "draft";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CalendarNav
          label={`${weekdays[0].getMonth() + 1}/${weekdays[0].getDate()} – ${
            weekdays[4].getMonth() + 1
          }/${weekdays[4].getDate()}`}
          onPrev={() => setWeekCursor((c) => previousBusinessWeek(c))}
          onNext={() => setWeekCursor((c) => nextBusinessWeek(c))}
          onToday={() => setWeekCursor(new Date())}
          todayLabel="This week"
        />
        <WeeklySubmissionStatusTag status={status} />
      </div>

      {status === "rejected" && submission?.rejectionReason && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Rejected: {submission.rejectionReason}
        </p>
      )}

      <WeeklyTaskGrid
        projects={gridProjects}
        weekdays={weekdays}
        entries={entriesThisWeek}
      />
    </div>
  );
}
