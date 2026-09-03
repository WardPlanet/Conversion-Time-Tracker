"use client";

import type { ReactNode } from "react";
import { addHours, format, isSameDay, startOfDay } from "date-fns";
import { toLocalDateString } from "@/lib/format";
import { layoutDayEvents, type TimedEvent } from "@/lib/domain/calendar-grid";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROW_HEIGHT = 48; // px per hour
const MIN_EVENT_HEIGHT = 28; // px — keeps very short bookings readable/clickable
const GUTTER_WIDTH = 52; // px — the time-label column
const SCROLL_MAX_HEIGHT = 620; // px — the default 7am–7pm range (12h) fits without scrolling; wider data-driven ranges scroll
/** Only every other hour gets a printed label (8 AM, 10 AM, ...) to cut clutter in the gutter — the underlying rows/positioning stay per-hour so bookings still land at their exact time. */
const LABEL_INTERVAL_HOURS = 2;

export interface WeekTimedItem extends TimedEvent {
  render: () => ReactNode;
}

export interface WeekAllDayItem {
  key: string;
  render: () => ReactNode;
}

/**
 * Google-Calendar-style day-by-hour week grid: 7 day columns, hourly rows,
 * events positioned by actual start/end time with overlapping events shown
 * side-by-side (via `layoutDayEvents`) instead of stacked/hidden. All-day
 * items (e.g. a full-day unavailability block) render as chips in a
 * separate row above the hourly grid rather than being time-positioned.
 */
export function WeekTimeGrid({
  days,
  today,
  hourStart,
  hourEnd,
  getAllDayItems,
  getTimedItems,
  onHeaderClick,
}: {
  days: Date[];
  today: Date;
  hourStart: number;
  hourEnd: number;
  getAllDayItems: (day: Date) => WeekAllDayItem[];
  getTimedItems: (day: Date) => WeekTimedItem[];
  /** Optional — makes each day's header (weekday + date) clickable, e.g. to jump to a single-day view for that date. */
  onHeaderClick?: (day: Date) => void;
}) {
  const hours = Array.from(
    { length: hourEnd - hourStart },
    (_, i) => hourStart + i
  );
  const totalHeight = hours.length * ROW_HEIGHT;
  const hasAllDayItems = days.some((day) => getAllDayItems(day).length > 0);

  return (
    <div className="overflow-hidden rounded-md border border-brand-darkBlue/10 bg-white shadow-sm">
      <div className="flex border-b border-brand-darkBlue/10 bg-brand-blueWater">
        <div className="shrink-0" style={{ width: GUTTER_WIDTH }} />
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          const headerInner = (
            <>
              <div className="text-xs font-medium text-brand-darkBlue/60">
                {WEEKDAY_LABELS[day.getDay()]}
              </div>
              <span
                className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? "bg-brand-blue font-medium text-white"
                    : "text-brand-darkBlue/80"
                }`}
              >
                {day.getDate()}
              </span>
            </>
          );
          return (
            <div
              key={toLocalDateString(day)}
              className="min-w-0 flex-1 border-l border-brand-darkBlue/10 text-center"
            >
              {onHeaderClick ? (
                <button
                  type="button"
                  onClick={() => onHeaderClick(day)}
                  className="w-full px-1 py-1.5 hover:bg-brand-blueWater/70"
                >
                  {headerInner}
                </button>
              ) : (
                <div className="px-1 py-1.5">{headerInner}</div>
              )}
            </div>
          );
        })}
      </div>

      {hasAllDayItems && (
        <div className="flex border-b border-brand-darkBlue/10">
          <div
            className="shrink-0 px-1 py-1 text-right text-[10px] text-brand-darkBlue/50"
            style={{ width: GUTTER_WIDTH }}
          >
            All day
          </div>
          {days.map((day) => (
            <div
              key={toLocalDateString(day)}
              className="min-w-0 flex-1 space-y-1 border-l border-brand-darkBlue/10 p-1"
            >
              {getAllDayItems(day).map((item) => (
                <div key={item.key}>{item.render()}</div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div
        className="flex overflow-y-auto"
        style={{ maxHeight: SCROLL_MAX_HEIGHT }}
      >
        <div
          className="relative shrink-0"
          style={{ width: GUTTER_WIDTH, height: totalHeight }}
        >
          {hours
            .filter((hour) => hour % LABEL_INTERVAL_HOURS === 0)
            .map((hour) => (
              <div
                key={hour}
                className="absolute right-1.5 -translate-y-1/2 text-xs text-brand-darkBlue/50"
                style={{ top: (hour - hourStart) * ROW_HEIGHT }}
              >
                {format(addHours(startOfDay(today), hour), "h a")}
              </div>
            ))}
        </div>

        {days.map((day) => {
          const items = getTimedItems(day);
          const layout = layoutDayEvents(items);
          const rangeStartMinutes = hourStart * 60;
          const rangeEndMinutes = hourEnd * 60;
          return (
            <div
              key={toLocalDateString(day)}
              className="relative min-w-0 flex-1 border-l border-brand-darkBlue/10"
              style={{
                height: totalHeight,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${ROW_HEIGHT - 1}px, rgba(15,23,42,0.06) ${ROW_HEIGHT - 1}px, rgba(15,23,42,0.06) ${ROW_HEIGHT}px)`,
              }}
            >
              {items.map((item) => {
                const startMinutes =
                  item.start.getHours() * 60 + item.start.getMinutes();
                const endMinutes =
                  item.end.getHours() * 60 + item.end.getMinutes();
                const clampedStart = Math.max(startMinutes, rangeStartMinutes);
                const clampedEnd = Math.min(
                  Math.max(endMinutes, clampedStart + 15),
                  rangeEndMinutes
                );
                const top =
                  ((clampedStart - rangeStartMinutes) / 60) * ROW_HEIGHT;
                const height = Math.max(
                  MIN_EVENT_HEIGHT,
                  ((clampedEnd - clampedStart) / 60) * ROW_HEIGHT
                );
                const { column, columnCount } = layout.get(item.id) ?? {
                  column: 0,
                  columnCount: 1,
                };
                return (
                  <div
                    key={item.id}
                    className="absolute px-0.5"
                    style={{
                      top,
                      height,
                      left: `${(column / columnCount) * 100}%`,
                      width: `${100 / columnCount}%`,
                    }}
                  >
                    {item.render()}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
