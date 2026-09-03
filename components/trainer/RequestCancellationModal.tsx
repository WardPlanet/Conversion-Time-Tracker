"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/Modal";

/**
 * The reason prompt for a trainer backing out of an already-`"accepted"`
 * booking — distinct from {@link RejectReasonModal}'s reject-a-pending-request
 * flow. Unlike that one, a reason here is required: the booking is already
 * committed, so an admin reviewing the request needs to know why.
 */
export function RequestCancellationModal({
  open,
  onClose,
  onConfirm,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setReason("");
    setError(null);
    onClose();
  }

  function handleSubmit() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A reason is required.");
      return;
    }
    setReason("");
    setError(null);
    onConfirm(trimmed);
  }

  return (
    <Modal open={open} onClose={handleClose} title="Request cancellation">
      <div className="flex items-start gap-3 rounded-md border border-brand-orange/30 bg-brand-orange/10 p-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
        <p className="text-sm text-brand-darkBlue/70">
          This booking is already accepted. Requesting cancellation sends it
          to the admin for review — it stays on your calendar until they
          approve or deny it.
        </p>
      </div>
      <label className="mt-4 block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Reason <span className="text-red-600">*</span>
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Why do you need to cancel this booking?"
          className="mt-1 w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={handleClose}
          className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-brand-orange px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-orange/90 disabled:opacity-50"
        >
          Request cancellation
        </button>
      </div>
    </Modal>
  );
}
