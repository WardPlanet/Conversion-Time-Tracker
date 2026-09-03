"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { formatHours } from "@/lib/format";

const AUTO_DISMISS_MS = 6000;
const EXIT_TRANSITION_MS = 300;

/**
 * One-time celebratory confirmation shown at the moment a week is submitted —
 * distinct from the persistent "Submitted — awaiting review" status banner
 * that stays on the grid afterward. Slides down from the top, auto-dismisses,
 * and never blocks interaction with the page underneath.
 */
export function WeekSubmittedBanner({
  totalHours,
  entryCount,
  projectCount,
  onDismiss,
}: {
  totalHours: number;
  entryCount: number;
  projectCount: number;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const dismissedRef = useRef(false);

  const close = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setVisible(false);
    setTimeout(onDismiss, EXIT_TRANSITION_MS);
  }, [onDismiss]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const autoDismiss = setTimeout(close, AUTO_DISMISS_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(autoDismiss);
    };
  }, [close]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto w-full max-w-md rounded-lg border border-brand-green/30 bg-white shadow-lg transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
        }`}
      >
        <div className="flex items-start gap-3 rounded-t-lg border-b border-brand-green/20 bg-brand-green/10 px-5 py-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-brand-green" />
          <div className="flex-1">
            <p className="text-base font-semibold text-brand-green">
              Week submitted!
            </p>
            <p className="text-sm text-brand-darkBlue/60">
              Your hours are now awaiting admin review.
            </p>
          </div>
          <button
            onClick={close}
            aria-label="Dismiss"
            className="text-brand-darkBlue/40 hover:text-brand-darkBlue/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 px-5 py-4">
          <div>
            <p className="text-xs text-brand-darkBlue/60">Total hours</p>
            <p className="text-xl font-semibold text-brand-darkBlue">
              {formatHours(totalHours)}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-darkBlue/60">Entries logged</p>
            <p className="text-xl font-semibold text-brand-darkBlue">
              {entryCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-darkBlue/60">Projects</p>
            <p className="text-xl font-semibold text-brand-darkBlue">
              {projectCount}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
