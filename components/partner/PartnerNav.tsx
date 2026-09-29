"use client";

import { ClipboardList } from "lucide-react";
import { Sidebar, type SidebarNavItem } from "@/components/nav/Sidebar";

const NAV_ITEMS: SidebarNavItem[] = [
  { href: "/partner", label: "Work Orders", icon: ClipboardList },
];

export function PartnerNav({ userName }: { userName: string }) {
  return (
    <Sidebar
      mainItems={NAV_ITEMS}
      settingsHref="/partner"
      dashboardHref="/partner"
      appLabel="Contract Trainer Time Tracker"
      userName={userName}
    />
  );
}
