import type { UnavailabilityBlock } from "@/lib/types";
import { parseLocalDateString, toLocalDateString } from "@/lib/format";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Whether a block covers the entire day — `startTime`/`endTime` are always set or unset together (enforced in `createUnavailabilityBlock`). */
export function isFullDayBlock(block: UnavailabilityBlock): boolean {
  return !block.startTime || !block.endTime;
}

/** Whether "YYYY-MM-DD" `dateStr` falls within a block's active range — for "recurring", also requires the weekday to match. */
export function isDateBlocked(
  block: UnavailabilityBlock,
  dateStr: string
): boolean {
  if (block.type === "one_time") {
    const end = block.endDate ?? block.startDate;
    return dateStr >= block.startDate && dateStr <= end;
  }

  if (dateStr < block.startDate) return false;
  if (block.endDate && dateStr > block.endDate) return false;
  return parseLocalDateString(dateStr).getDay() === block.recurringDayOfWeek;
}

/** Every block (from an already trainer-scoped list) active on `dateStr`. */
export function blocksForDate(
  blocks: UnavailabilityBlock[],
  dateStr: string
): UnavailabilityBlock[] {
  return blocks.filter((b) => isDateBlocked(b, dateStr));
}

/**
 * Whether a proposed booking window [startIso, endIso) overlaps ANY of the
 * trainer's unavailability blocks — walks each local calendar day the
 * booking touches. Used only to drive the admin's soft warning; never to
 * reject a booking outright (that's the separate, unmodified hard conflict
 * check in `lib/domain/booking-conflicts.ts`).
 */
export function findOverlappingUnavailability(
  blocks: UnavailabilityBlock[],
  startIso: string,
  endIso: string
): UnavailabilityBlock | null {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor < end) {
    const dateStr = toLocalDateString(cursor);
    for (const block of blocksForDate(blocks, dateStr)) {
      if (isFullDayBlock(block)) return block;
      const blockStart = new Date(`${dateStr}T${block.startTime}`);
      const blockEnd = new Date(`${dateStr}T${block.endTime}`);
      if (start < blockEnd && end > blockStart) return block;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return null;
}

export function formatHHMM(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/** "Every Tuesday, 9:00 AM – 12:00 PM" / "Aug 10 – Aug 12, all day" — a human-readable summary for the trainer's own block list. */
export function formatUnavailabilityLabel(block: UnavailabilityBlock): string {
  const dayPart =
    block.type === "recurring"
      ? `Every ${DAY_NAMES[block.recurringDayOfWeek ?? 0]}`
      : block.endDate && block.endDate !== block.startDate
        ? `${block.startDate} – ${block.endDate}`
        : block.startDate;
  const timePart = isFullDayBlock(block)
    ? "all day"
    : `${formatHHMM(block.startTime!)} – ${formatHHMM(block.endTime!)}`;
  return `${dayPart}, ${timePart}`;
}

/**
 * Short label for a single day's unavailability chip on a calendar grid —
 * e.g. "Riley Lee — 1:00 PM–3:00 PM unavailable" (admin view, multiple
 * trainers) or "All day unavailable" (trainer's own calendar, name omitted).
 */
export function formatUnavailabilityChipLabel(
  block: UnavailabilityBlock,
  trainerName?: string
): string {
  const timePart = isFullDayBlock(block)
    ? "All day"
    : `${formatHHMM(block.startTime!)}–${formatHHMM(block.endTime!)}`;
  return trainerName
    ? `${trainerName} — ${timePart} unavailable`
    : `${timePart} unavailable`;
}
