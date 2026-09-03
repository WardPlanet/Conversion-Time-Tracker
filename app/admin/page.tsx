import { notFound } from "next/navigation";
import { store } from "@/lib/data";
import { getSession } from "@/lib/auth/get-session";
import { QuickActions } from "@/components/admin/QuickActions";
import { DashboardCard } from "@/components/trainer/DashboardCard";
import { BillableSplitBar } from "@/components/trainer/BillableSplitBar";
import { LocationSplitBar } from "@/components/trainer/LocationSplitBar";
import { HoursTrendChart } from "@/components/trainer/HoursTrendChart";
import { FlagsList } from "@/components/admin/FlagsList";
import { startOfWeek, startOfMonth } from "@/lib/domain/worked-hours";
import {
  computeBillableSplit,
  computeLocationSplit,
  computeTotalHours,
  computeWeeklyHoursTrend,
} from "@/lib/domain/dashboard-insights";
import { enrichFlags } from "@/lib/domain/flags";
import { formatHours } from "@/lib/format";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) notFound();
  const actor = { id: session.userId, role: session.role };

  const [trainers, projects, bookings, taskEntries, tasks, flags] =
    await Promise.all([
      store.listTrainers(),
      store.listProjects(),
      store.listAllBookings(),
      store.listAllTaskEntries(),
      store.listAllTasks(),
      store.listActiveFlags(actor),
    ]);

  const activeTrainerCount = trainers.filter((t) => t.active).length;
  const activeProjects = projects.filter((p) => p.status === "active");
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  const now = new Date();
  const hoursThisWeek = computeTotalHours(taskEntries, startOfWeek(now), now);
  const hoursThisMonth = computeTotalHours(taskEntries, startOfMonth(now), now);
  const billableSplit = computeBillableSplit(
    taskEntries,
    tasks,
    bookings,
    startOfMonth(now),
    now
  );
  const locationSplit = computeLocationSplit(
    taskEntries,
    bookings,
    startOfMonth(now),
    now
  );
  const weeklyTrend = computeWeeklyHoursTrend(taskEntries, 6, now);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Dashboard</h1>

      <QuickActions />

      <section className="mt-6">
        <FlagsList
          compact
          initialFlags={enrichFlags(flags, trainers, bookings, projects)}
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active trainers" value={activeTrainerCount} />
        <StatCard label="Active projects" value={activeProjects.length} />
        <StatCard label="Pending bookings" value={pendingCount} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total hours this week" value={formatHours(hoursThisWeek)} />
        <StatCard label="Total hours this month" value={formatHours(hoursThisMonth)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardCard title="Billable hours this month">
          <BillableSplitBar split={billableSplit} />
        </DashboardCard>
        <DashboardCard title="On-site vs. remote this month">
          <LocationSplitBar split={locationSplit} />
        </DashboardCard>
      </div>

      <div className="mt-4">
        <DashboardCard title="Hours logged — last 6 weeks" bodyClassName="p-5">
          <HoursTrendChart data={weeklyTrend} />
        </DashboardCard>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Projects</h2>
        <ul className="mt-3 space-y-2">
          {activeProjects.map((project) => (
            <li
              key={project.id}
              className="flex items-center gap-3 rounded-md border border-brand-darkBlue/10 bg-white shadow-sm px-4 py-3"
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="font-medium">{project.name}</span>
              <span className="text-sm text-brand-darkBlue/60">
                {project.productLine}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm px-4 py-3">
      <p className="text-sm text-brand-darkBlue/60">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
