import Link from "next/link";
import { store } from "@/lib/data";
import { getSession } from "@/lib/auth/get-session";
import { computeTrainerStats } from "@/lib/domain/trainer-stats";
import { startOfMonth } from "@/lib/domain/worked-hours";
import {
  computeBillableSplit,
  computeProjectTaskProgress,
  computeWeeklyHoursTrend,
} from "@/lib/domain/dashboard-insights";
import { formatFullDate, formatHours } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { ProjectDot } from "@/components/trainer/badges";
import { BillableSplitBar } from "@/components/trainer/BillableSplitBar";
import { HoursTrendChart } from "@/components/trainer/HoursTrendChart";
import { BookingsProvider } from "@/components/trainer/BookingsProvider";
import { PendingBookingsStatCard } from "@/components/trainer/PendingBookingsStatCard";
import { NextBookingCard } from "@/components/trainer/NextBookingCard";
import { PendingBookingsSection } from "@/components/trainer/PendingBookingsSection";
import { DashboardCard } from "@/components/trainer/DashboardCard";
import { QuickActions } from "@/components/trainer/QuickActions";

export default async function TrainerDashboardPage() {
  const session = await getSession();
  const trainerId = session!.userId;

  const [stats, projects, tasks, taskEntries, bookings] = await Promise.all([
    computeTrainerStats(store, trainerId),
    store.listProjects(),
    store.listTasksForTrainer(trainerId),
    store.listTaskEntriesForTrainer(trainerId),
    store.listBookingsForTrainer(trainerId),
  ]);
  const { hoursThisWeek, hoursThisMonth, tasksCompletedCount } = stats;

  const now = new Date();
  const billableSplit = computeBillableSplit(
    taskEntries,
    tasks,
    bookings,
    startOfMonth(now),
    now
  );
  const projectProgress = computeProjectTaskProgress(tasks, projects);
  const weeklyTrend = computeWeeklyHoursTrend(taskEntries, 6, now);

  return (
    <BookingsProvider initialBookings={bookings} now={now.toISOString()}>
      <div>
        <h1 className="text-2xl font-semibold text-brand-blue">Dashboard</h1>
        <p className="mt-1 text-sm text-brand-darkBlue/50">
          {formatFullDate(now)}
        </p>

        <QuickActions />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Hours this week" value={formatHours(hoursThisWeek)} />
          <StatCard
            label="Hours this month"
            value={formatHours(hoursThisMonth)}
          />
          <StatCard label="Tasks completed" value={String(tasksCompletedCount)} />
          <PendingBookingsStatCard />
        </div>

        <div className="mt-5">
          <NextBookingCard projects={projects} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-stretch">
          <div className="flex flex-col gap-4">
            <PendingBookingsSection projects={projects} />

            <DashboardCard title="Billable hours this month">
              <BillableSplitBar split={billableSplit} />
            </DashboardCard>
          </div>

          <DashboardCard
            title="Project progress"
            className="h-full"
            footer={
              <Link
                href="/trainer/projects"
                className="block rounded-md bg-brand-blue px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-darkBlue"
              >
                View Projects
              </Link>
            }
          >
            {projectProgress.length === 0 ? (
              <p className="text-sm text-brand-darkBlue/60">
                No checklist tasks yet.
              </p>
            ) : (
              <div className="space-y-4">
                {projectProgress.map((p) => (
                  <div key={p.project.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ProjectDot color={p.project.color} />
                        <span className="text-sm font-medium text-brand-darkBlue">
                          {p.project.name}
                        </span>
                      </div>
                      <span className="text-sm text-brand-darkBlue/60">
                        {p.completedCount} of {p.totalCount} complete
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-blueWater">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${p.progressPercent}%`,
                          backgroundColor: p.project.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        <div className="mt-4">
          <DashboardCard title="Hours logged — last 6 weeks" bodyClassName="p-5">
            <HoursTrendChart data={weeklyTrend} />
          </DashboardCard>
        </div>
      </div>
    </BookingsProvider>
  );
}
