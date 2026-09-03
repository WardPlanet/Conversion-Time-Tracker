import { formatHours } from "@/lib/format";

export interface SplitBarSegment {
  label: string;
  hours: number;
  colorClass: string;
}

/**
 * Two-way hours split — a filled progress bar plus a labeled legend below
 * it. Shared by {@link BillableSplitBar} and the on-site/remote split so
 * both stay pixel-identical instead of each keeping its own copy.
 */
export function SplitBar({
  segments,
  emptyMessage,
}: {
  segments: readonly [SplitBarSegment, SplitBarSegment];
  emptyMessage: string;
}) {
  const total = segments[0].hours + segments[1].hours;

  if (total === 0) {
    return <p className="text-sm text-brand-darkBlue/60">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-brand-blueWater">
        {segments.map((segment) => {
          const percent = (segment.hours / total) * 100;
          return percent > 0 ? (
            <div
              key={segment.label}
              className={`h-full ${segment.colorClass}`}
              style={{ width: `${percent}%` }}
            />
          ) : null;
        })}
      </div>
      <div className="mt-3 flex gap-8">
        {segments.map((segment) => (
          <div key={segment.label}>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${segment.colorClass}`}
              />
              <span className="text-sm text-brand-darkBlue/70">
                {segment.label}
              </span>
            </div>
            <p className="mt-0.5 text-lg font-semibold text-brand-darkBlue">
              {formatHours(segment.hours)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
