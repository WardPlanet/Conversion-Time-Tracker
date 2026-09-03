"use client";

import { isSameMonth, isSameDay } from "date-fns";
import { toLocalDateString } from "@/lib/format";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Renders any number of 7-day week rows as a calendar grid. Works for both
 * month view (many weeks, non-current-month days dimmed via
 * `referenceMonth`) and week view (a single week, pass `referenceMonth={null}`
 * so no day is dimmed).
 */
export function CalendarGrid({
  weeks,
  referenceMonth,
  today,
  renderDayContent,
  onDayClick,
  highlightedDate,
}: {
  weeks: Date[][];
  referenceMonth: Date | null;
  today: Date;
  renderDayContent: (day: Date) => React.ReactNode;
  /**
   * Optional whole-cell click handler (e.g. "click an empty day to book
   * it"). The caller decides when it should actually act — e.g. no-op for
   * days that already have bookings — since this component has no opinion
   * on what a day's contents mean.
   */
  onDayClick?: (day: Date) => void;
  /** Local "YYYY-MM-DD" of a day to visually flash — e.g. after clicking a related item elsewhere on the page. Each day cell also gets a stable `id` so callers can `scrollIntoView` it. */
  highlightedDate?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-brand-darkBlue/10 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-brand-darkBlue/10 bg-brand-blueWater">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium text-brand-darkBlue/60"
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week, weekIndex) => (
        <div
          key={weekIndex}
          className="grid grid-cols-7 divide-x divide-brand-darkBlue/10 border-b border-brand-darkBlue/10 last:border-b-0"
        >
          {week.map((day) => {
            const inMonth = !referenceMonth || isSameMonth(day, referenceMonth);
            const isToday = isSameDay(day, today);
            const dateStr = toLocalDateString(day);
            const isHighlighted = highlightedDate === dateStr;
            return (
              <div
                key={dateStr}
                id={`calendar-day-${dateStr}`}
                onClick={onDayClick ? () => onDayClick(day) : undefined}
                className={`min-h-[110px] p-1.5 transition-colors ${inMonth ? "bg-white" : "bg-brand-blueWater/40"} ${onDayClick ? "cursor-pointer hover:bg-brand-blueWater" : ""} ${isHighlighted ? "bg-brand-orange/10 ring-2 ring-inset ring-brand-orange" : ""}`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-brand-blue font-medium text-white"
                      : inMonth
                        ? "text-brand-darkBlue/80"
                        : "text-brand-darkBlue/40"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="mt-1 space-y-1">{renderDayContent(day)}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
