"use client";

import { AlertTriangle, Plane } from "lucide-react";
import type { Booking, Office, Project } from "@/lib/types";
import { formatTime } from "@/lib/format";

/**
 * Left-accent color signals status at a glance; pending additionally gets a
 * dashed outline so it visually reads as "needs a response".
 */
export const STATUS_CHIP_STYLES: Record<Booking["status"], string> = {
  pending: "border border-dashed border-brand-orange/50 border-l-[3px] border-l-brand-orange",
  accepted: "border border-brand-darkBlue/10 border-l-[3px] border-l-brand-green",
  rejected: "border border-brand-darkBlue/10 border-l-[3px] border-l-red-400 opacity-60",
  reassigned: "border border-brand-darkBlue/10 border-l-[3px] border-l-brand-darkBlue",
  rebooked: "border border-brand-darkBlue/10 border-l-[3px] border-l-brand-blue",
  cancellation_requested: "border border-dashed border-brand-orange/50 border-l-[3px] border-l-brand-orange",
  cancelled: "border border-brand-darkBlue/10 border-l-[3px] border-l-red-400 opacity-60",
};

export function BookingChip({
  booking,
  project,
  office,
  label,
  onClick,
}: {
  booking: Booking;
  project: Project | null;
  office?: Office | null;
  /** Extra label after the time, e.g. the trainer's name on the admin calendar. */
  label?: string;
  onClick: () => void;
}) {
  if (booking.bookingType === "travel") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={booking.title}
        className="flex w-full items-center gap-1 overflow-hidden rounded bg-slate-100 px-1.5 py-0.5 text-left text-[11px] leading-tight text-slate-600 shadow-sm hover:bg-slate-200 border border-slate-300 border-l-[3px] border-l-slate-400"
      >
        <Plane className="h-2.5 w-2.5 shrink-0 text-slate-500" />
        <span className="truncate">
          Travel{label ? ` · ${label}` : ""}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={booking.title}
      className={`flex w-full items-center gap-1 overflow-hidden rounded bg-white px-1.5 py-0.5 text-left text-[11px] leading-tight text-brand-darkBlue shadow-sm hover:bg-brand-blueWater ${STATUS_CHIP_STYLES[booking.status]}`}
    >
      {booking.status === "cancellation_requested" ? (
        <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-brand-orange" />
      ) : (
        project && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />
        )
      )}
      <span className="truncate">
        {booking.allDay ? "All day" : formatTime(booking.startTime)}
        {label ? ` · ${label}` : ""}
        {office ? ` · ${office.name}` : ""}
      </span>
    </button>
  );
}
