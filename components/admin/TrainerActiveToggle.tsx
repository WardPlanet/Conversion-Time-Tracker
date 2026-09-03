"use client";

import { useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/types";

/**
 * Activate/deactivate control for a trainer. Works from both a
 * client-managed list (pass `onToggled` to refetch) and a server-rendered
 * page (omit it — falls back to `router.refresh()` to re-run the server
 * component with the new state).
 */
export function TrainerActiveToggle({
  trainer,
  onToggled,
}: {
  trainer: PublicUser;
  onToggled?: () => void;
}) {
  const router = useRouter();

  async function toggle() {
    const response = await fetch(`/api/admin/trainers/${trainer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !trainer.active }),
    });
    if (response.ok) {
      if (onToggled) onToggled();
      else router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={
          trainer.active
            ? "text-xs font-medium text-brand-green"
            : "text-xs font-medium text-brand-darkBlue/50"
        }
      >
        {trainer.active ? "Active" : "Deactivated"}
      </span>
      <button
        onClick={toggle}
        className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-sm hover:bg-brand-blueWater"
      >
        {trainer.active ? "Deactivate" : "Reactivate"}
      </button>
    </div>
  );
}
