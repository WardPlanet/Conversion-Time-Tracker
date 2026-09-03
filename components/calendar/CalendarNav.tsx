"use client";

export function CalendarNav({
  label,
  onPrev,
  onNext,
  onToday,
  todayLabel = "Today",
  viewMode,
  onViewModeChange,
  showDayOption = false,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  todayLabel?: string;
  viewMode?: "month" | "week" | "day";
  onViewModeChange?: (mode: "month" | "week" | "day") => void;
  /** Adds a third "Day" option to the toggle — only the admin Scheduling calendar uses it today. */
  showDayOption?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          aria-label="Previous"
          className="rounded-md border border-brand-darkBlue/20 px-2 py-1 text-sm text-brand-darkBlue hover:bg-brand-blueWater"
        >
          ‹
        </button>
        <button
          onClick={onToday}
          className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-sm text-brand-darkBlue hover:bg-brand-blueWater"
        >
          {todayLabel}
        </button>
        <button
          onClick={onNext}
          aria-label="Next"
          className="rounded-md border border-brand-darkBlue/20 px-2 py-1 text-sm text-brand-darkBlue hover:bg-brand-blueWater"
        >
          ›
        </button>
        <h2 className="ml-2 text-lg font-medium text-brand-darkBlue">{label}</h2>
      </div>

      {onViewModeChange && (
        <div className="flex rounded-md border border-brand-darkBlue/20 text-sm">
          <button
            onClick={() => onViewModeChange("month")}
            className={`rounded-l-md px-3 py-1 ${
              viewMode === "month"
                ? "bg-brand-blue text-white"
                : "text-brand-darkBlue hover:bg-brand-blueWater"
            }`}
          >
            Month
          </button>
          <button
            onClick={() => onViewModeChange("week")}
            className={`px-3 py-1 ${showDayOption ? "" : "rounded-r-md"} ${
              viewMode === "week"
                ? "bg-brand-blue text-white"
                : "text-brand-darkBlue hover:bg-brand-blueWater"
            }`}
          >
            Week
          </button>
          {showDayOption && (
            <button
              onClick={() => onViewModeChange("day")}
              className={`rounded-r-md px-3 py-1 ${
                viewMode === "day"
                  ? "bg-brand-blue text-white"
                  : "text-brand-darkBlue hover:bg-brand-blueWater"
              }`}
            >
              Day
            </button>
          )}
        </div>
      )}
    </div>
  );
}
