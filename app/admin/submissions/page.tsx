import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { store } from "@/lib/data";
import { enrichWeeklySubmissions } from "@/lib/domain/weekly-submissions";
import { enrichTimesheetSubmissions } from "@/lib/domain/timesheet-submissions";
import { enrichExpenses } from "@/lib/domain/expenses";
import { enrichClockCorrectionRequests } from "@/lib/domain/clock-corrections";
import { enrichManualSessionRequests } from "@/lib/domain/manual-sessions";
import { AdminSubmissionsTabs } from "@/components/admin/AdminSubmissionsTabs";

export default async function AdminSubmissionsPage() {
  const session = await getSession();
  if (!session) notFound();
  const actor = { id: session.userId, role: session.role };

  const [
    weeklySubmissions,
    timesheetSubmissions,
    expenses,
    clockCorrectionRequests,
    manualSessionRequests,
    trainers,
    taskEntries,
    timeClockEvents,
    projects,
  ] = await Promise.all([
    store.listPendingWeeklySubmissions(actor),
    store.listPendingTimesheetSubmissions(actor),
    store.listPendingExpenses(actor),
    store.listPendingClockCorrectionRequests(actor),
    store.listPendingManualSessionRequests(actor),
    store.listTrainers(),
    store.listAllTaskEntries(),
    store.listAllTimeClockEvents(),
    store.listProjects(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Submissions</h1>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        Weekly Task Tracker, Timesheet, Expense, and Correction requests
        awaiting review, across every trainer.
      </p>

      <div className="mt-6">
        <AdminSubmissionsTabs
          initialTaskLogSubmissions={enrichWeeklySubmissions(
            weeklySubmissions,
            trainers,
            taskEntries
          )}
          initialTimesheetSubmissions={enrichTimesheetSubmissions(
            timesheetSubmissions,
            trainers,
            timeClockEvents
          )}
          initialExpenses={enrichExpenses(expenses, trainers, projects)}
          initialClockCorrectionRequests={enrichClockCorrectionRequests(
            clockCorrectionRequests,
            trainers,
            timeClockEvents
          )}
          initialManualSessionRequests={enrichManualSessionRequests(
            manualSessionRequests,
            trainers
          )}
        />
      </div>
    </div>
  );
}
