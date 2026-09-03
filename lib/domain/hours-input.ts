/** Quick-fill presets shown next to the Hours field — static for now, not personalized per trainer/task history. */
export const HOURS_PRESETS = ["30m", "1h", "2h", "4h", "8h"];

const HOURS_AND_MINUTES = /^(\d+(?:\.\d+)?)\s*h\s*(\d+(?:\.\d+)?)\s*m$/i;
const HOURS_ONLY = /^(\d+(?:\.\d+)?)\s*h$/i;
const MINUTES_ONLY = /^(\d+(?:\.\d+)?)\s*m$/i;
const PLAIN_DECIMAL = /^(\d+(?:\.\d+)?)$/;

/**
 * Parses an Hours field value into a decimal number of hours. Accepts
 * "1h 30m" / "1h30m", "45m", "2h", or a plain decimal like "2.5" — anything
 * else (including empty input) returns `null` so the caller can show a
 * parse error instead of submitting NaN or garbage.
 */
export function parseHoursInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hoursAndMinutes = trimmed.match(HOURS_AND_MINUTES);
  if (hoursAndMinutes) {
    return parseFloat(hoursAndMinutes[1]) + parseFloat(hoursAndMinutes[2]) / 60;
  }

  const hoursOnly = trimmed.match(HOURS_ONLY);
  if (hoursOnly) {
    return parseFloat(hoursOnly[1]);
  }

  const minutesOnly = trimmed.match(MINUTES_ONLY);
  if (minutesOnly) {
    return parseFloat(minutesOnly[1]) / 60;
  }

  const plainDecimal = trimmed.match(PLAIN_DECIMAL);
  if (plainDecimal) {
    return parseFloat(plainDecimal[1]);
  }

  return null;
}
