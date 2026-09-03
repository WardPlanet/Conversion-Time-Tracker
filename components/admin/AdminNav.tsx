"use client";

import {
  Users,
  CalendarClock,
  FolderKanban,
  ClipboardCheck,
} from "lucide-react";
import { Sidebar, type SidebarNavItem } from "@/components/nav/Sidebar";
import { AdminNotificationBell } from "@/components/admin/AdminNotificationBell";

const NAV_ITEMS: SidebarNavItem[] = [
  { href: "/admin/trainers", label: "Trainers", icon: Users },
  { href: "/admin/scheduling", label: "Scheduling", icon: CalendarClock },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/submissions", label: "Submissions", icon: ClipboardCheck },
];

export function AdminNav({ userName }: { userName: string }) {
  return (
    <Sidebar
      mainItems={NAV_ITEMS}
      settingsHref="/admin/settings"
      dashboardHref="/admin"
      appLabel="Contract Trainer Time Tracker"
      userName={userName}
      bottomExtra={(menuPosition) => (
        <AdminNotificationBell menuPosition={menuPosition} />
      )}
    />
  );
}
