"use client";

import { useState, type FormEvent } from "react";
import type { BillableStatus, Booking, BookingLocation } from "@/lib/types";
import { toDateTimeLocalValue } from "@/lib/format";

export interface RescheduleUpdates {
  startTime: string;
  endTime: string;
  location: BookingLocation;
  billable: BillableStatus;
  reason: string;
  allDay: boolean;
}

function toDateValue(iso: string): string {
  return iso.slice(0, 10);
}

function localMidnight(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function localEndOfDay(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59`).toISOString();
}

/**
 * The reschedule popup's editable fields — same fields the old always-visible
 * quick-edit form had (start, end, location, billable), plus an optional
 * reason. Submitting resets the booking to "pending", so the trainer
 * re-confirms the new time through the same accept/reject flow as a fresh
 * booking.
 */
export function RescheduleBookingForm({
  booking,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  booking: Booking;
  onSubmit: (updates: RescheduleUpdates) => void;
  onCancel: () => void;
  submitting: boolean;
  error?: string | null;
}) {
  const [allDay, setAllDay] = useState(booking.allDay ?? false);
  const [form, setForm] = useState({
    startTime: toDateTimeLocalValue(booking.startTime),
    endTime: toDateTimeLocalValue(booking.endTime),
    startDate: toDateValue(booking.startTime),
    endDate: toDateValue(booking.endTime),
    location: booking.location,
    billable: booking.billable,
    reason: "",
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startTime = allDay
      ? localMidnight(form.startDate)
      : new Date(form.startTime).toISOString();
    const endTime = allDay
      ? localEndOfDay(form.endDate)
      : new Date(form.endTime).toISOString();
    onSubmit({
      startTime,
      endTime,
      location: form.location,
      billable: form.billable,
      reason: form.reason.trim(),
      allDay,
    });
  }

  const inputClass =
    "mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue";

  return (
    <div>
      <p className="text-sm text-brand-darkBlue/70">
        This resets the booking to pending — the trainer will need to
        re-accept the new time.
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 rounded border-brand-darkBlue/30 text-brand-blue focus:ring-brand-blue"
          />
          <span className="text-sm font-medium text-brand-darkBlue/80">All day</span>
        </label>

        {allDay ? (
          <>
            <label className="block">
              <span className="block text-sm font-medium text-brand-darkBlue/80">
                Start date
              </span>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-brand-darkBlue/80">
                End date
              </span>
              <input
                type="date"
                required
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
                className={inputClass}
              />
            </label>
          </>
        ) : (
          <>
            <label className="block">
              <span className="block text-sm font-medium text-brand-darkBlue/80">
                Start
              </span>
              <input
                type="datetime-local"
                required
                value={form.startTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startTime: e.target.value }))
                }
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-brand-darkBlue/80">End</span>
              <input
                type="datetime-local"
                required
                value={form.endTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endTime: e.target.value }))
                }
                className={inputClass}
              />
            </label>
          </>
        )}

        <label className="block">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Location
          </span>
          <select
            value={form.location}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                location: e.target.value as BookingLocation,
              }))
            }
            className={inputClass}
          >
            <option value="on_site">On-site</option>
            <option value="remote">Remote</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Billable
          </span>
          <select
            value={form.billable}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                billable: e.target.value as BillableStatus,
              }))
            }
            className={inputClass}
          >
            <option value="billable">Billable</option>
            <option value="non_billable">Non-billable</option>
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Reason (optional)
          </span>
          <textarea
            value={form.reason}
            onChange={(e) =>
              setForm((f) => ({ ...f, reason: e.target.value }))
            }
            rows={2}
            placeholder="Let the trainer know why, if helpful"
            className="mt-1 w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>

        {error && (
          <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater"
          >
            Never mind
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
          >
            {submitting ? "Rescheduling…" : "Reschedule booking"}
          </button>
        </div>
      </form>
    </div>
  );
}
