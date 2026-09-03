import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { store } from "@/lib/data";
import { TrainerActiveToggle } from "@/components/admin/TrainerActiveToggle";
import { FlagsList } from "@/components/admin/FlagsList";
import { StatCard } from "@/components/StatCard";
import {
  ProjectDot,
  LocationTag,
  WeeklySubmissionStatusTag,
} from "@/components/trainer/badges";
import {
  filterEntriesForWeek,
  getBusinessWeekDays,
  sumHours,
} from "@/lib/domain/task-entry-grid";
import {
  findWeekSubmission,
  formatWeekLabel,
  weekStartDateFor,
} from "@/lib/domain/weekly-submissions";
import { computeTrainerStats } from "@/lib/domain/trainer-stats";
import { computeBillableSplit } from "@/lib/domain/dashboard-insights";
import { BillableSplitBar } from "@/components/trainer/BillableSplitBar";
import { enrichFlags } from "@/lib/domain/flags";
import {
  formatDateRange,
  formatDateTime,
  formatHours,
  toLocalDateString,
} from "@/lib/format";

export default async function TrainerOverviewTab({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) notFound();
  const actor = { id: session.userId, role: session.role };

  const [trainer, taskEntries, tasks, projects, weeklySubmissions, trainers, bookings, flags, stats] =
    await Promise.all([
      store.getUserById(params.id),
      store.listTaskEntriesForTrainer(params.id),
      store.listTasksForTrainer(params.id),
      store.listProjects(),
      store.listWeeklySubmissionsForTrainer(params.id, actor),
      store.listTrainers(),
      store.listBookingsForTrainer(params.id),
      store.listActiveFlagsForTrainer(params.id, actor),
      computeTrainerStats(store, params.id),
    ]);
  if (!trainer || trainer.role !== "trainer") notFound();

  // Never pass the raw User (with passwordHash) to a client component —
  // strip it before it can reach TrainerActiveToggle's props.
  const { passwordHash: _passwordHash, ...publicTrainer } = trainer;

  const projectsById = new Map(projects.map((p) => [p.id, p]));

  // Task Tracker's own current business week (Mon–Fri).
  const weekdays = getBusinessWeekDays(new Date());
  const weekStartDate = weekStartDateFor(toLocalDateString(weekdays[0]));
  const currentSubmission = findWeekSubmission(weeklySubmissions, weekStartDate);

  const entriesThisWeek = filterEntriesForWeek(taskEntries, weekdays);
  const weekTotalHours = sumHours(entriesThisWeek);

  const billableSplit = computeBillableSplit(
    taskEntries,
    tasks,
    bookings,
    weekdays[0],
    weekdays[weekdays.length - 1]
  );

  const enrichedFlags = enrichFlags(flags, trainers, bookings, projects);

  return (
    <div>
      <h2 className="text-lg font-medium">Overview</h2>

      <div className="mt-4 rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4">
        <h3 className="text-sm font-medium text-brand-darkBlue/80">
          Trainer Info
        </h3>

        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-brand-darkBlue/60">Name</dt>
            <dd className="text-sm text-brand-darkBlue">{publicTrainer.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-brand-darkBlue/60">Username</dt>
            <dd className="text-sm text-brand-darkBlue">{publicTrainer.username}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-brand-darkBlue/60">Email</dt>
            <dd className="text-sm text-brand-darkBlue">{publicTrainer.email}</dd>
          </div>
        </dl>

        <div className="mt-3">
          <TrainerActiveToggle trainer={publicTrainer} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hours this week" value={formatHours(weekTotalHours)} />
        <StatCard label="Hours this month" value={formatHours(stats.hoursThisMonth)} />
        <StatCard label="Tasks completed" value={String(stats.tasksCompletedCount)} />
        <Link href={`/admin/trainers/${params.id}/calendar`} className="block">
          <StatCard
            label="Pending bookings"
            value={String(stats.pendingBookings.length)}
            highlight={stats.pendingBookings.length > 0}
          />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-brand-darkBlue/80">
              Weekly submission
            </h3>
            <WeeklySubmissionStatusTag status={currentSubmission?.status ?? "draft"} />
          </div>
          <p className="mt-1 text-sm text-brand-darkBlue/60">
            {formatWeekLabel(weekStartDate)}
          </p>

          {!currentSubmission && (
            <p className="mt-2 text-sm text-brand-darkBlue/50">
              Not yet submitted.
            </p>
          )}
          {currentSubmission?.status === "submitted" && currentSubmission.submittedAt && (
            <p className="mt-2 text-sm text-brand-darkBlue/70">
              Submitted {formatDateTime(currentSubmission.submittedAt)}.
            </p>
          )}
          {currentSubmission?.status === "approved" && currentSubmission.reviewedAt && (
            <p className="mt-2 text-sm text-brand-darkBlue/70">
              Approved {formatDateTime(currentSubmission.reviewedAt)}.
            </p>
          )}
          {currentSubmission?.status === "rejected" && (
            <p className="mt-2 text-sm text-red-600">
              Rejected
              {currentSubmission.reviewedAt &&
                ` ${formatDateTime(currentSubmission.reviewedAt)}`}
              {currentSubmission.rejectionReason &&
                ` — “${currentSubmission.rejectionReason}”`}
            </p>
          )}

          <Link
            href={`/admin/trainers/${params.id}/task-log`}
            className="mt-3 inline-block text-sm font-medium text-brand-blue hover:underline"
          >
            View Task Log →
          </Link>
        </section>

        <section className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4">
          <h3 className="text-sm font-medium text-brand-darkBlue/80">
            Billable vs. non-billable this week
          </h3>
          <div className="mt-3">
            <BillableSplitBar
              split={billableSplit}
              emptyMessage="No billable-linked hours logged yet this week."
            />
          </div>
        </section>

        <section className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4">
          <h3 className="text-sm font-medium text-brand-darkBlue/80">
            Upcoming bookings
          </h3>

          {stats.upcomingAcceptedBookings.length === 0 ? (
            <p className="mt-2 text-sm text-brand-darkBlue/50">
              No upcoming bookings.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {stats.upcomingAcceptedBookings.map((booking) => {
                const project = projectsById.get(booking.projectId) ?? null;
                return (
                  <li
                    key={booking.id}
                    className="rounded-md border border-brand-darkBlue/10 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-brand-darkBlue">
                      {project && <ProjectDot color={project.color} />}
                      {project?.name ?? "Unknown project"}
                    </div>
                    <p className="mt-1 text-xs text-brand-darkBlue/60">
                      {formatDateRange(booking.startTime, booking.endTime)}
                    </p>
                    <div className="mt-1.5">
                      <LocationTag location={booking.location} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href={`/admin/trainers/${params.id}/calendar`}
            className="mt-3 inline-block text-sm font-medium text-brand-blue hover:underline"
          >
            View full calendar →
          </Link>
        </section>

        <section className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4">
          <FlagsList
            initialFlags={enrichedFlags}
            trainerId={params.id}
            showTrainerLink={false}
            compact
          />
          <Link
            href={`/admin/trainers/${params.id}/flags`}
            className="mt-3 inline-block text-sm font-medium text-brand-blue hover:underline"
          >
            View Flags tab →
          </Link>
        </section>
      </div>
    </div>
  );
}
