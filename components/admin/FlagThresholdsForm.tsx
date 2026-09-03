"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { FlagThresholds } from "@/lib/types";

/** Configures the thresholds that drive automatic flag detection (see lib/domain/flags.ts) — a single global config, not per-trainer. */
export function FlagThresholdsForm() {
  const [form, setForm] = useState<FlagThresholds | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/admin/flag-thresholds");
      const data = await response.json();
      setForm(data.thresholds);
    }
    load();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setError(null);
    setSaved(false);
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/flag-thresholds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to save thresholds.");
        return;
      }

      setForm(data.thresholds);
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (!form) {
    return <p className="text-sm text-brand-darkBlue/60">Loading…</p>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      <label className="block">
        <span className="block min-h-[2.5rem] text-sm font-medium text-brand-darkBlue/80">
          Days without task entries before flagging
        </span>
        <input
          type="number"
          min={1}
          required
          value={form.unsubmittedTaskTrackerDays}
          onChange={(e) =>
            setForm((f) => f && { ...f, unsubmittedTaskTrackerDays: Number(e.target.value) })
          }
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      <label className="block">
        <span className="block min-h-[2.5rem] text-sm font-medium text-brand-darkBlue/80">
          Hours before a pending booking is "unanswered"
        </span>
        <input
          type="number"
          min={1}
          required
          value={form.pendingBookingUnansweredHours}
          onChange={(e) =>
            setForm(
              (f) => f && { ...f, pendingBookingUnansweredHours: Number(e.target.value) }
            )
          }
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      <label className="block">
        <span className="block min-h-[2.5rem] text-sm font-medium text-brand-darkBlue/80">
          Days of inactivity before flagging a trainer
        </span>
        <input
          type="number"
          min={1}
          required
          value={form.inactiveTrainerDays}
          onChange={(e) =>
            setForm((f) => f && { ...f, inactiveTrainerDays: Number(e.target.value) })
          }
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      {error && <p className="sm:col-span-3 text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="sm:col-span-3 text-sm text-brand-green">Thresholds saved.</p>
      )}

      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save thresholds"}
        </button>
      </div>
    </form>
  );
}
