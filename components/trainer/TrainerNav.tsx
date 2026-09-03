"use client";

import { CalendarDays, ListChecks, FolderKanban, Clock, Receipt } from "lucide-react";
import { Sidebar, type SidebarNavItem } from "@/components/nav/Sidebar";
import { TrainerNotificationBell } from "@/components/trainer/TrainerNotificationBell";

const NAV_ITEMS: SidebarNavItem[] = [
  { href: "/trainer/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/trainer/task-tracker", label: "Task Tracker", icon: ListChecks },
  { href: "/trainer/projects", label: "Projects", icon: FolderKanban },
  { href: "/trainer/time-clock", label: "Time Clock", icon: Clock },
  { href: "/trainer/expenses", label: "Expenses", icon: Receipt },
];

export function TrainerNav({ userName }: { userName: string }) {
  return (
    <Sidebar
      mainItems={NAV_ITEMS}
      settingsHref="/trainer/settings"
      dashboardHref="/trainer"
      appLabel="Contract Trainer Time Tracker"
      userName={userName}
      bottomExtra={(menuPosition) => (
        <TrainerNotificationBell menuPosition={menuPosition} />
      )}
    />
  );
}
