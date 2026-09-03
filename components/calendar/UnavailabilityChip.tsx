"use client";

import type { UnavailabilityBlock } from "@/lib/types";
import { formatUnavailabilityChipLabel } from "@/lib/domain/unavailability";

/**
 * Diagonal-stripe fill scaled down to chip size — the same "informational,
 * not a status color" idea the old whole-cell background used, just applied
 * to a small chip instead of the entire day cell.
 */
const UNAVAILABLE_CHIP_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(100,116,139,0.2), rgba(100,116,139,0.2) 3px, transparent 3px, transparent 6px)",
};

/**
 * Stands alongside `BookingChip` in a day cell to show a trainer's declared
 * unavailability — deliberately styled as "not a booking" (dashed border,
 * hatched fill, muted text) rather than reusing any booking status color.
 */
export function UnavailabilityChip({
  block,
  trainerName,
  onClick,
}: {
  block: UnavailabilityBlock;
  /** Included in the chip label on the admin Scheduling calendar (multiple trainers); omitted on a trainer's own calendar. */
  trainerName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={UNAVAILABLE_CHIP_STYLE}
      className="flex w-full items-center overflow-hidden rounded border border-dashed border-brand-darkBlue/30 bg-brand-blueWater/50 px-1.5 py-0.5 text-left text-[11px] leading-tight text-brand-darkBlue/70 hover:bg-brand-blueWater"
    >
      <span className="truncate">
        {formatUnavailabilityChipLabel(block, trainerName)}
      </span>
    </button>
  );
}
