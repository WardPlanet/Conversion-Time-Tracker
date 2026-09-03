import Link from "next/link";
import { CalendarDays, Clock, ListChecks, Receipt } from "lucide-react";

/** Fast shortcuts to the full Task Tracker/Time Clock/Calendar pages — plain navigation, no modals, mirroring the admin Dashboard's Quick Actions styling. */
export function QuickActions() {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-medium">Quick actions</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link
          href="/trainer/task-tracker"
          className="flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
        >
          <ListChecks className="h-4 w-4" />
          Log a task
        </Link>
        <Link
          href="/trainer/time-clock"
          className="flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
        >
          <Clock className="h-4 w-4" />
          Time clock
        </Link>
        <Link
          href="/trainer/calendar"
          className="flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
        >
          <CalendarDays className="h-4 w-4" />
          View calendar
        </Link>
        <Link
          href="/trainer/expenses"
          className="flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
        >
          <Receipt className="h-4 w-4" />
          Report expense
        </Link>
      </div>
    </section>
  );
}
