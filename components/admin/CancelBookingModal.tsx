"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

/**
 * Confirmation before an admin directly cancels a booking — immediate, no
 * approval step (unlike the trainer-initiated cancellation request flow).
 * The reason is optional and, if given, is saved on the booking and
 * included in the trainer's notification.
 */
export function CancelBookingModal({
  open,
  onClose,
  onConfirm,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  submitting: boolean;
  error?: string | null;
}) {
  const [reason, setReason] = useState("");

  function handleClose() {
    setReason("");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Cancel booking">
      <p className="text-sm text-brand-darkBlue/70">
        This immediately cancels the booking and notifies the trainer.
        Optionally let them know why.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Reason (optional)"
        className="mt-3 w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={handleClose}
          className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater"
        >
          Never mind
        </button>
        <button
          onClick={() => {
            const trimmed = reason.trim();
            setReason("");
            onConfirm(trimmed);
          }}
          disabled={submitting}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {submitting ? "Cancelling…" : "Cancel booking"}
        </button>
      </div>
    </Modal>
  );
}
