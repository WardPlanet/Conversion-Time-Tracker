import type { BillableSplit } from "@/lib/domain/dashboard-insights";
import { SplitBar } from "@/components/trainer/SplitBar";

/** Reuses the same orange = billable / dark blue = non-billable pairing already established by {@link BillableTag}, just as solid fills instead of light badge backgrounds. */
export function BillableSplitBar({
  split,
  emptyMessage = "No billable-linked hours logged yet this month.",
}: {
  split: BillableSplit;
  emptyMessage?: string;
}) {
  return (
    <SplitBar
      segments={[
        {
          label: "Billable",
          hours: split.billableHours,
          colorClass: "bg-brand-orange",
        },
        {
          label: "Non-billable",
          hours: split.nonBillableHours,
          colorClass: "bg-brand-darkBlue",
        },
      ]}
      emptyMessage={emptyMessage}
    />
  );
}
