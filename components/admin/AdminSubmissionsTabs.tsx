"use client";

import { useState } from "react";
import { SubmissionsList } from "@/components/admin/SubmissionsList";
import { TimesheetSubmissionsList } from "@/components/admin/TimesheetSubmissionsList";
import { ExpensesList } from "@/components/admin/ExpensesList";
import { ClockCorrectionsList } from "@/components/admin/ClockCorrectionsList";
import { ManualSessionRequestsList } from "@/components/admin/ManualSessionRequestsList";
import type { EnrichedWeeklySubmission } from "@/lib/domain/weekly-submissions";
import type { EnrichedTimesheetSubmission } from "@/lib/domain/timesheet-submissions";
import type { EnrichedExpense } from "@/lib/domain/expenses";
import type { EnrichedClockCorrectionRequest } from "@/lib/domain/clock-corrections";
import type { EnrichedManualSessionRequest } from "@/lib/domain/manual-sessions";

type SubmissionsTab = "task_logs" | "timesheets" | "expenses" | "corrections";

/** Splits the review queue into Task Logs (WeeklySubmission), Timesheets (TimesheetSubmission), Expenses, and Corrections (clock correction + missed-day requests) — independent review workflows sharing one page. */
export function AdminSubmissionsTabs({
  initialTaskLogSubmissions,
  initialTimesheetSubmissions,
  initialExpenses,
  initialClockCorrectionRequests,
  initialManualSessionRequests,
}: {
  initialTaskLogSubmissions: EnrichedWeeklySubmission[];
  initialTimesheetSubmissions: EnrichedTimesheetSubmission[];
  initialExpenses: EnrichedExpense[];
  initialClockCorrectionRequests: EnrichedClockCorrectionRequest[];
  initialManualSessionRequests: EnrichedManualSessionRequest[];
}) {
  const [tab, setTab] = useState<SubmissionsTab>("task_logs");

  return (
    <div>
      <div className="flex gap-2 border-b border-brand-darkBlue/10">
        <TabButton active={tab === "task_logs"} onClick={() => setTab("task_logs")}>
          Task Logs
        </TabButton>
        <TabButton active={tab === "timesheets"} onClick={() => setTab("timesheets")}>
          Timesheets
        </TabButton>
        <TabButton active={tab === "expenses"} onClick={() => setTab("expenses")}>
          Expenses
        </TabButton>
        <TabButton active={tab === "corrections"} onClick={() => setTab("corrections")}>
          Corrections
        </TabButton>
      </div>

      <div className="mt-4">
        {tab === "task_logs" && (
          <SubmissionsList initialSubmissions={initialTaskLogSubmissions} />
        )}
        {tab === "timesheets" && (
          <TimesheetSubmissionsList
            initialSubmissions={initialTimesheetSubmissions}
          />
        )}
        {tab === "expenses" && (
          <ExpensesList initialExpenses={initialExpenses} />
        )}
        {tab === "corrections" && (
          <div>
            <section>
              <h2 className="text-lg font-medium">Correction requests</h2>
              <div className="mt-3">
                <ClockCorrectionsList
                  initialRequests={initialClockCorrectionRequests}
                />
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-medium">Missed-day requests</h2>
              <div className="mt-3">
                <ManualSessionRequestsList
                  initialRequests={initialManualSessionRequests}
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? "border-brand-blue text-brand-blue"
          : "border-transparent text-brand-darkBlue/60 hover:text-brand-darkBlue"
      }`}
    >
      {children}
    </button>
  );
}
