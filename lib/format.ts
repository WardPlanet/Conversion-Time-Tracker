const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { timeStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function formatFullDate(date: Date): string {
  return fullDateFormatter.format(date);
}

export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${dateFormatter.format(start)}, ${timeFormatter.format(
    start
  )}–${timeFormatter.format(end)}`;
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** "2h 14m" (or just "8m" under an hour) — for a live-ticking elapsed-time display, not a precise report. */
export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses a "YYYY-MM-DD" string as a local-time date, avoiding the UTC-midnight pitfall of `new Date(string)`. */
export function parseLocalDateString(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Formats an ISO datetime as a "YYYY-MM-DDTHH:mm" value for an `<input type="datetime-local">`. */
export function toDateTimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
