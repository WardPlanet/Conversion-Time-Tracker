import type { LocationSplit } from "@/lib/domain/dashboard-insights";
import { SplitBar } from "@/components/trainer/SplitBar";

/** On-site (blue) vs. remote (green) — a pairing distinct from the billable split's orange/dark-blue so the two bars read independently when shown side by side. */
export function LocationSplitBar({ split }: { split: LocationSplit }) {
  return (
    <SplitBar
      segments={[
        {
          label: "On-site",
          hours: split.onSiteHours,
          colorClass: "bg-brand-blue",
        },
        {
          label: "Remote",
          hours: split.remoteHours,
          colorClass: "bg-brand-green",
        },
      ]}
      emptyMessage="No location-linked hours logged yet this month."
    />
  );
}
