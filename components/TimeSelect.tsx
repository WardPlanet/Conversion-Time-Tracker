"use client";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = ["00", "15", "30", "45"];
type Period = "AM" | "PM";

function to12Hour(value: string): { hour: number; minute: string; period: Period } {
  const [h, m] = value.split(":").map(Number);
  const period: Period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { hour, minute: String(m).padStart(2, "0"), period };
}

function to24Hour(hour: number, minute: string, period: Period): string {
  const h = period === "PM" ? (hour % 12) + 12 : hour % 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

const FIELD_CLASS =
  "rounded-md border border-brand-darkBlue/20 bg-white py-1 text-xs shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue";

/**
 * Compact hour/minute/AM-PM dropdown trio, all on one line, standing in for
 * a native `<input type="time">` — the native control hides the AM/PM
 * indicator once a value is set and its scroll-wheel picker has no clear
 * start/end. Internally still stores and emits a plain "HH:mm" 24-hour
 * string, so callers (and the ISO-conversion/conflict-checking code
 * downstream) don't change. Shared by both the admin Book Trainer form and
 * the trainer's Log Missed Day form.
 */
export function TimeSelect({
  value,
  onChange,
  label,
}: {
  value: string; // "HH:mm", 24-hour
  onChange: (value: string) => void;
  label: string;
}) {
  const { hour, minute, period } = to12Hour(value);

  return (
    <div className="mt-1 flex items-center gap-1">
      <select
        aria-label={`${label} hour`}
        value={hour}
        onChange={(e) => onChange(to24Hour(Number(e.target.value), minute, period))}
        className={`${FIELD_CLASS} w-12 pl-1.5 pr-0.5`}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} minute`}
        value={minute}
        onChange={(e) => onChange(to24Hour(hour, e.target.value, period))}
        className={`${FIELD_CLASS} w-12 pl-1.5 pr-0.5`}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} AM or PM`}
        value={period}
        onChange={(e) => onChange(to24Hour(hour, minute, e.target.value as Period))}
        className={`${FIELD_CLASS} w-14 pl-1.5 pr-0.5`}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
