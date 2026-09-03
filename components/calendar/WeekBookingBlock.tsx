"use client";

import { AlertTriangle } from "lucide-react";
import type { Booking, Project } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { STATUS_CHIP_STYLES } from "@/components/calendar/BookingChip";

/**
 * A booking rendered as a full-height time-positioned block for the week
 * grid — same status color-coding as `BookingChip`, just taller so it can
 * show the time on its own line and the trainer + project on a second,
 * rather than one fully truncated line. Kept to two lines (instead of
 * three) so it still reads at the grid's more compact row height.
 */
export function WeekBookingBlock({
  booking,
  project,
  trainerName,
  onClick,
}: {
  booking: Booking;
  project: Project | null;
  trainerName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={booking.title}
      className={`flex h-full w-full flex-col items-start justify-center gap-0.5 overflow-hidden rounded bg-white px-1.5 py-1 text-left text-xs leading-tight text-brand-darkBlue shadow-sm hover:bg-brand-blueWater ${STATUS_CHIP_STYLES[booking.status]}`}
    >
      <span className="flex w-full items-center gap-1 font-medium">
        {booking.status === "cancellation_requested" ? (
          <AlertTriangle className="h-3 w-3 shrink-0 text-brand-orange" />
        ) : (
          project && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
          )
        )}
        <span className="truncate">{formatTime(booking.startTime)}</span>
      </span>
      <span className="w-full truncate text-brand-darkBlue/70">
        {trainerName ? `${trainerName} · ` : ""}
        {project?.name ?? "Unknown project"}
      </span>
    </button>
  );
}
