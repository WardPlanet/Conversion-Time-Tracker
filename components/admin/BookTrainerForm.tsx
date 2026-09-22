"use client";

import { useState, type FormEvent } from "react";
import type {
  BillableStatus,
  Booking,
  BookingLocation,
  Office,
  Project,
  PublicUser,
  UnavailabilityBlock,
} from "@/lib/types";
import { formatDateRange } from "@/lib/format";
import { TimeSelect } from "@/components/TimeSelect";
import { findOverlappingUnavailability } from "@/lib/domain/unavailability";

function emptyForm(defaultDate?: string) {
  return {
    trainerId: "",
    projectId: "",
    officeId: "",
    title: "",
    startDate: defaultDate ?? "",
    endDate: defaultDate ?? "",
    allDay: false,
    startTime: "09:00",
    endTime: "17:00",
    location: "on_site" as BookingLocation,
    billable: "billable" as BillableStatus,
    notes: "",
  };
}

/** Returns every "YYYY-MM-DD" date in [start, end] inclusive. */
function getDatesInRange(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates: string[] = [];
  // Use noon to avoid any midnight DST edge cases
  const current = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  if (current > last) return [];
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/** Returns the date N days offset from a "YYYY-MM-DD" string. */
function offsetDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Booking creation form for the admin Scheduling calendar. Supports
 * multi-day date ranges and an "All day" toggle. Always adds one travel day
 * before and one after the training block. On a 409 conflict response,
 * shows the conflicting booking inline and keeps the form filled in.
 */
export function BookTrainerForm({
  trainers,
  projects,
  offices,
  unavailabilityBlocks,
  defaultDate,
  onCreated,
}: {
  trainers: PublicUser[];
  projects: Project[];
  offices: Office[];
  unavailabilityBlocks: UnavailabilityBlock[];
  defaultDate?: string; // "YYYY-MM-DD"
  onCreated: () => void;
}) {
  const [form, setForm] = useState(() => emptyForm(defaultDate));
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Booking | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledgedOverlapKey, setAcknowledgedOverlapKey] = useState<
    string | null
  >(null);

  const activeTrainers = trainers.filter((t) => t.active);
  const activeProjects = projects.filter((p) => p.status === "active");
  const officesForSelectedProject = offices.filter(
    (o) => o.projectId === form.projectId
  );

  const trainingDates = getDatesInRange(form.startDate, form.endDate);
  const travelBeforeDate = form.startDate ? offsetDate(form.startDate, -1) : "";
  const travelAfterDate = form.endDate ? offsetDate(form.endDate, 1) : "";

  const overlapKey = `${form.trainerId}|${form.startDate}|${form.endDate}|${form.startTime}|${form.endTime}|${form.allDay}`;
  const trainerUnavailability = form.trainerId
    ? unavailabilityBlocks.filter((b) => b.trainerId === form.trainerId)
    : [];
  const overlappingBlock =
    form.trainerId && trainingDates.length > 0
      ? trainingDates.reduce<UnavailabilityBlock | null>((found, date) => {
          if (found) return found;
          const start = new Date(
            `${date}T${form.allDay ? "09:00" : form.startTime}`
          ).toISOString();
          const end = new Date(
            `${date}T${form.allDay ? "17:00" : form.endTime}`
          ).toISOString();
          return findOverlappingUnavailability(trainerUnavailability, start, end);
        }, null)
      : null;
  const overlapAcknowledged = acknowledgedOverlapKey === overlapKey;
  const selectedTrainerName = trainers.find((t) => t.id === form.trainerId)?.name;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConflict(null);

    if (overlappingBlock && !overlapAcknowledged) return;

    setSubmitting(true);

    try {
      const groupId = crypto.randomUUID();

      const response = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainerId: form.trainerId,
          projectId: form.projectId,
          officeId: form.officeId,
          title: form.title,
          trainingDates,
          allDay: form.allDay,
          startTime: form.startTime,
          endTime: form.endTime,
          location: form.location,
          billable: form.billable,
          notes: form.notes || undefined,
          groupId,
          travelBeforeDate: travelBeforeDate || undefined,
          travelAfterDate: travelAfterDate || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.conflict) {
          setConflict(data.conflict);
        }
        setError(data.error ?? "Failed to create booking.");
        return;
      }

      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <label className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Trainer
        </span>
        <select
          required
          value={form.trainerId}
          onChange={(e) =>
            setForm((f) => ({ ...f, trainerId: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          <option value="">Select a trainer</option>
          {activeTrainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Project
        </span>
        <select
          required
          value={form.projectId}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              projectId: e.target.value,
              officeId: "",
            }))
          }
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          <option value="">Select a project</option>
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block sm:col-span-2">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          OID
        </span>
        <select
          required
          disabled={!form.projectId}
          value={form.officeId}
          onChange={(e) =>
            setForm((f) => ({ ...f, officeId: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-blueWater/50 disabled:text-brand-darkBlue/40"
        >
          <option value="">
            {form.projectId ? "Select an OID" : "Select a project first"}
          </option>
          {officesForSelectedProject.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block sm:col-span-2">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Title
        </span>
        <input
          type="text"
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      {/* Date range */}
      <label className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Start date
        </span>
        <input
          type="date"
          required
          value={form.startDate}
          onChange={(e) => {
            const startDate = e.target.value;
            setForm((f) => ({
              ...f,
              startDate,
              // Keep endDate >= startDate
              endDate: f.endDate && f.endDate >= startDate ? f.endDate : startDate,
            }));
          }}
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          End date
        </span>
        <input
          type="date"
          required
          min={form.startDate}
          value={form.endDate}
          onChange={(e) =>
            setForm((f) => ({ ...f, endDate: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      {/* All day toggle + time pickers */}
      <div className="sm:col-span-2">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={form.allDay}
            onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
            className="h-4 w-4 rounded border-brand-darkBlue/20 text-brand-blue"
          />
          <span className="text-sm font-medium text-brand-darkBlue/80">All day</span>
        </label>

        {!form.allDay && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-brand-darkBlue/80">
                Start
              </span>
              <TimeSelect
                label="Start time"
                value={form.startTime}
                onChange={(startTime) => setForm((f) => ({ ...f, startTime }))}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-brand-darkBlue/80">
                End
              </span>
              <TimeSelect
                label="End time"
                value={form.endTime}
                onChange={(endTime) => setForm((f) => ({ ...f, endTime }))}
              />
            </label>
          </div>
        )}
      </div>

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
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
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
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          <option value="billable">Billable</option>
          <option value="non_billable">Non-billable</option>
        </select>
      </label>

      <label className="block sm:col-span-2">
        <span className="block text-sm font-medium text-brand-darkBlue/80">
          Notes (optional)
        </span>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      {/* Schedule preview */}
      {trainingDates.length > 0 && (
        <div className="sm:col-span-2 rounded-md border border-brand-darkBlue/10 bg-brand-blueWater/50 px-3 py-2 text-sm text-brand-darkBlue/80">
          <p className="font-medium text-brand-darkBlue">Schedule preview</p>
          <ul className="mt-1 space-y-0.5">
            {travelBeforeDate && (
              <li className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                <span>{formatShortDate(travelBeforeDate)} — Travel day</span>
              </li>
            )}
            {trainingDates.map((d) => (
              <li key={d} className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-brand-blue" />
                <span>
                  {formatShortDate(d)}
                  {form.allDay ? " — All day" : ` · ${form.startTime} – ${form.endTime}`}
                </span>
              </li>
            ))}
            {travelAfterDate && (
              <li className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                <span>{formatShortDate(travelAfterDate)} — Travel day</span>
              </li>
            )}
          </ul>
          <p className="mt-1.5 text-xs text-brand-darkBlue/60">
            {trainingDates.length} training day{trainingDates.length !== 1 ? "s" : ""} + 2 travel days
          </p>
        </div>
      )}

      {overlappingBlock && !conflict && (
        <div className="sm:col-span-2 rounded-md border border-brand-orange/30 bg-brand-orange/10 p-3 text-sm text-brand-orange">
          <p className="font-medium">Trainer marked unavailable</p>
          <p className="mt-1">
            {selectedTrainerName ?? "This trainer"} has marked one or more of
            these dates as unavailable
            {overlappingBlock.reason ? ` ("${overlappingBlock.reason}")` : ""}.
            You can still book it.
          </p>
          <label className="mt-2 flex items-center gap-2 text-brand-darkBlue">
            <input
              type="checkbox"
              checked={overlapAcknowledged}
              onChange={(e) =>
                setAcknowledgedOverlapKey(e.target.checked ? overlapKey : null)
              }
              className="h-4 w-4 rounded border-brand-darkBlue/20"
            />
            Book anyway
          </label>
        </div>
      )}

      {conflict && (
        <div className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">Scheduling conflict</p>
          <p className="mt-1">
            This trainer already has &quot;{conflict.title}&quot; booked{" "}
            {formatDateRange(conflict.startTime, conflict.endTime)}. Adjust
            the dates/time or pick a different trainer.
          </p>
        </div>
      )}
      {error && !conflict && (
        <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting || (overlappingBlock !== null && !overlapAcknowledged)}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
        >
          {submitting ? "Booking…" : "Book trainer"}
        </button>
      </div>
    </form>
  );
}
