"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/format";

/**
 * The correction-request form for a single past Time Clock event — opened
 * from a "Request correction" link next to that specific clock in/out or
 * break event in the Activity log. Reason is required; a fresh instance
 * mounts each time the Modal opens (it fully unmounts while closed, same as
 * the reject/cancellation modals), so no reset effect is needed between
 * different target events.
 */
export function RequestClockCorrectionModal({
  open,
  onClose,
  originalTimestamp,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  originalTimestamp: string;
  submitting: boolean;
  onConfirm: (requestedTimestampIso: string, reason: string) => void;
}) {
  const [requestedTime, setRequestedTime] = useState(() =>
    toDateTimeLocalValue(originalTimestamp)
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!requestedTime) {
      setError("A corrected time is required.");
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("A reason is required.");
      return;
    }
    setError(null);
    onConfirm(new Date(requestedTime).toISOString(), trimmedReason);
  }

  return (
    <Modal open={open} onClose={onClose} title="Request correction">
      <p className="text-sm text-brand-darkBlue/60">
        Original time:{" "}
        <span className="font-medium text-brand-darkBlue">
          {formatDateTime(originalTimestamp)}
        </span>
      </p>

      <label className="mt-4 block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Corrected time
        </span>
        <input
          type="datetime-local"
          value={requestedTime}
          onChange={(e) => setRequestedTime(e.target.value)}
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      <label className="mt-4 block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Reason <span className="text-red-600">*</span>
        </span>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why does this need to be corrected?"
          className="mt-1 w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </Modal>
  );
}
