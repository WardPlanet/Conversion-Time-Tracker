"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

/**
 * The reason prompt shown before a reject actually goes through — shared by
 * every reject entry point (Dashboard, Calendar sidebar, Calendar detail
 * modal) so the reason capture UI isn't rebuilt three times.
 */
export function RejectReasonModal({
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

  function handleClose() {
    setReason("");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Reject booking">
      <p className="text-sm text-brand-darkBlue/70">
        Optionally let the admin know why — this is saved with the
        rejection.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Reason (optional)"
        className="mt-3 w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={handleClose}
          className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            const trimmed = reason.trim();
            setReason("");
            onConfirm(trimmed);
          }}
          disabled={submitting}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
        >
          Reject booking
        </button>
      </div>
    </Modal>
  );
}
