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
    date: defaultDate ?? "",
    startTime: "09:00",
    endTime: "10:00",
    location: "on_site" as BookingLocation,
    billable: "billable" as BillableStatus,
    notes: "",
  };
}

/**
 * Booking creation form for the admin Scheduling calendar. On a 409
 * conflict response, shows the conflicting booking inline and keeps the
 * form filled in so the admin can adjust the time or trainer and resubmit —
 * it never closes or clears on a conflict.
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
  /** Every trainer's unavailability blocks — filtered by `form.trainerId` internally to drive the soft "book anyway?" warning below. Not a hard restriction, unlike the 409 conflict check. */
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

  const overlapKey = `${form.trainerId}|${form.date}|${form.startTime}|${form.endTime}`;
  const overlappingBlock =
    form.trainerId && form.date
      ? findOverlappingUnavailability(
          unavailabilityBlocks.filter((b) => b.trainerId === form.trainerId),
          new Date(`${form.date}T${form.startTime}`).toISOString(),
          new Date(`${form.date}T${form.endTime}`).toISOString()
        )
      : null;
  const overlapAcknowledged = acknowledgedOverlapKey === overlapKey;
  const selectedTrainerName = trainers.find((t) => t.id === form.trainerId)?.name;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConflict(null);

    if (overlappingBlock && !overlapAcknowledged) {
      return;
    }

    setSubmitting(true);

    try {
      const startTime = new Date(
        `${form.date}T${form.startTime}`
      ).toISOString();
      const endTime = new Date(`${form.date}T${form.endTime}`).toISOString();

      const response = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainerId: form.trainerId,
          projectId: form.projectId,
          officeId: form.officeId,
          title: form.title,
          startTime,
          endTime,
          location: form.location,
          billable: form.billable,
          notes: form.notes || undefined,
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
          Office
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
            {form.projectId ? "Select an office" : "Select a project first"}
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

      <label className="block sm:col-span-2">
        <span className="block text-sm font-medium text-brand-darkBlue/80">Date</span>
        <input
          type="date"
          required
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>

      <div className="grid grid-cols-2 gap-4 sm:col-span-2">
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

      {overlappingBlock && !conflict && (
        <div className="sm:col-span-2 rounded-md border border-brand-orange/30 bg-brand-orange/10 p-3 text-sm text-brand-orange">
          <p className="font-medium">Trainer marked unavailable</p>
          <p className="mt-1">
            {selectedTrainerName ?? "This trainer"} has marked this time as
            unavailable
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
            the time or pick a different trainer.
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
