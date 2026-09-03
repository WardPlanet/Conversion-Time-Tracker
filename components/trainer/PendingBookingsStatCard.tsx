"use client";

import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { useBookingsContext } from "@/components/trainer/BookingsProvider";

export function PendingBookingsStatCard() {
  const { pendingBookings } = useBookingsContext();

  return (
    <Link href="/trainer/calendar" className="block">
      <StatCard
        label="Pending bookings"
        value={String(pendingBookings.length)}
        highlight={pendingBookings.length > 0}
      />
    </Link>
  );
}
