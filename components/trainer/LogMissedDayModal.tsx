"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { TimeSelect } from "@/components/TimeSelect";
import { toLocalDateString } from "@/lib/format";

interface BreakRow {
  start: string; // "HH:mm", 24-hour
  end: string; // "HH:mm", 24-hour
}

/**
 * The "log a missed day" form — lets a trainer retroactively add a full
 * session (clock-in, optional breaks, clock-out) for a past day they forgot
 * to clock in/out for entirely. Reason is required, same as a correction
 * request. A fresh instance mounts each time the Modal opens (it fully
 * unmounts while closed), so no reset effect is needed between openings.
 * Clock in/out and break times use the same compact hour/minute/AM-PM
 * dropdown trio as the admin's Book Trainer form, so a complete, valid time
 * is always selected — no free-text parsing or partial values possible.
 */
export function LogMissedDayModal({
  open,
  onClose,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  submitting: boolean;
  onConfirm: (input: {
    date: string;
    clockIn: string;
    clockOut: string;
    breaks: { start: string; end: string }[];
    reason: string;
  }) => void;
}) {
  const [date, setDate] = useState(() => toLocalDateString(new Date()));
  const [clockIn, setClockIn] = useState("08:00");
  const [clockOut, setClockOut] = useState("17:00");
  const [breaks, setBreaks] = useState<BreakRow[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addBreak() {
    setBreaks((prev) => [...prev, { start: "12:00", end: "12:30" }]);
  }

  function removeBreak(index: number) {
    setBreaks((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBreak(index: number, field: "start" | "end", value: string) {
    setBreaks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    );
  }

  function toIso(time: string) {
    return new Date(`${date}T${time}`).toISOString();
  }

  function handleSubmit() {
    if (!date) {
      setError("Date is required.");
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("A reason is required.");
      return;
    }

    setError(null);
    onConfirm({
      date,
      clockIn: toIso(clockIn),
      clockOut: toIso(clockOut),
      breaks: breaks.map((b) => ({
        start: toIso(b.start),
        end: toIso(b.end),
      })),
      reason: trimmedReason,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Log a missed day">
      <p className="text-sm text-brand-darkBlue/60">
        Retroactively log a full day you forgot to clock in/out for. This is
        sent to an admin for approval before it appears on your timesheet.
      </p>

      <label className="mt-4 block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Date
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Clock in
          </span>
          <TimeSelect label="Clock in" value={clockIn} onChange={setClockIn} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Clock out
          </span>
          <TimeSelect label="Clock out" value={clockOut} onChange={setClockOut} />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Breaks (optional)
          </span>
          <button
            type="button"
            onClick={addBreak}
            className="flex items-center gap-1 text-sm text-brand-blue hover:text-brand-darkBlue"
          >
            <Plus className="h-3.5 w-3.5" />
            Add break
          </button>
        </div>
        {breaks.length > 0 && (
          <div className="mt-2 space-y-2">
            {breaks.map((brk, index) => (
              <div key={index} className="flex items-center gap-2">
                <TimeSelect
                  label={`Break ${index + 1} start`}
                  value={brk.start}
                  onChange={(v) => updateBreak(index, "start", v)}
                />
                <span className="text-brand-darkBlue/40">–</span>
                <TimeSelect
                  label={`Break ${index + 1} end`}
                  value={brk.end}
                  onChange={(v) => updateBreak(index, "end", v)}
                />
                <button
                  type="button"
                  onClick={() => removeBreak(index)}
                  title="Remove break"
                  aria-label="Remove break"
                  className="shrink-0 text-brand-darkBlue/40 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="mt-4 block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Reason <span className="text-red-600">*</span>
        </span>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you logging this day manually?"
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
