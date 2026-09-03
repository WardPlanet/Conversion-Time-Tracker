"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TrainerProfileNav({ trainerId }: { trainerId: string }) {
  const pathname = usePathname();
  const base = `/admin/trainers/${trainerId}`;

  const items = [
    { href: base, label: "Overview" },
    { href: `${base}/task-log`, label: "Task Log" },
    { href: `${base}/checklist`, label: "Projects" },
    { href: `${base}/timesheet`, label: "Timesheet" },
    { href: `${base}/calendar`, label: "Calendar" },
    { href: `${base}/flags`, label: "Flags" },
  ];

  return (
    <nav className="flex gap-4 border-b border-brand-darkBlue/10 pb-3 text-sm">
      {items.map((item) => {
        const isActive =
          item.href === base ? pathname === base : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              isActive
                ? "font-medium text-brand-blue"
                : "text-brand-darkBlue/60 hover:text-brand-darkBlue"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
