"use client";

import { useState, type FormEvent } from "react";
import type { UnavailabilityBlock, UnavailabilityType } from "@/lib/types";
import { formatUnavailabilityLabel } from "@/lib/domain/unavailability";
import { toLocalDateString } from "@/lib/format";
import { TimeSelect } from "@/components/TimeSelect";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function emptyForm() {
  return {
    type: "one_time" as UnavailabilityType,
    startDate: toLocalDateString(new Date()),
    endDate: "",
    multiDay: false,
    setTime: false,
    startTime: "",
    endTime: "",
    recurringDayOfWeek: 1,
    reason: "",
  };
}

/**
 * Lets a trainer freely add/remove "don't schedule me" windows — no
 * approval needed. Purely informational for admin scheduling (a soft
 * warning on overlap, never a hard restriction), so there's no
 * conflict-checking here either.
 */
export function AvailabilityManager({
  blocks,
  onChanged,
}: {
  blocks: UnavailabilityBlock[];
  onChanged: () => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/trainer/unavailability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          startTime: form.startTime || undefined,
          endTime: form.endTime || undefined,
          recurringDayOfWeek:
            form.type === "recurring" ? form.recurringDayOfWeek : undefined,
          reason: form.reason || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to add block.");
        return;
      }

      setForm(emptyForm());
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(blockId: string) {
    setDeletingId(blockId);
    try {
      await fetch(`/api/trainer/unavailability/${blockId}`, {
        method: "DELETE",
      });
      onChanged();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <p className="text-sm text-brand-darkBlue/60">
        Block off time you&apos;re unavailable — this is a heads-up for
        admins when scheduling, not a hard restriction.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid grid-cols-1 gap-4 rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6 sm:grid-cols-2"
      >
        <label className="block">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Type
          </span>
          <select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                type: e.target.value as UnavailabilityType,
              }))
            }
            className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            <option value="one_time">One-time</option>
            <option value="recurring">Recurring (weekly)</option>
          </select>
        </label>

        {form.type === "recurring" ? (
          <label className="block">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Day of week
            </span>
            <select
              value={form.recurringDayOfWeek}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  recurringDayOfWeek: Number(e.target.value),
                }))
              }
              className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            >
              {DAY_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex items-center pt-6">
            <label className="flex items-center gap-2 text-sm font-medium text-brand-darkBlue/80">
              <input
                type="checkbox"
                checked={form.multiDay}
                onChange={(e) => {
                  const multiDay = e.target.checked;
                  setForm((f) => ({
                    ...f,
                    multiDay,
                    endDate: multiDay ? f.endDate : "",
                  }));
                }}
                className="h-4 w-4 rounded border-brand-darkBlue/20"
              />
              Block multiple days
            </label>
          </div>
        )}

        {form.type === "recurring" ? (
          <>
            <label className="block">
              <span className="block text-sm font-medium text-brand-darkBlue/80">
                Starting
              </span>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-brand-darkBlue/80">
                Until (optional — leave blank for indefinite)
              </span>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
            </label>
          </>
        ) : (
          <>
            <div className="block">
              <label className="block">
                <span className="block text-sm font-medium text-brand-darkBlue/80">
                  Start
                </span>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                />
              </label>
              {form.multiDay && (
                <label className="mt-2 block">
                  <span className="block text-sm font-medium text-brand-darkBlue/80">
                    End
                  </span>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                    className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                  />
                </label>
              )}
            </div>
            <div />
          </>
        )}

        <div className="block sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium text-brand-darkBlue/80">
            <input
              type="checkbox"
              checked={form.setTime}
              onChange={(e) => {
                const setTime = e.target.checked;
                setForm((f) => ({
                  ...f,
                  setTime,
                  startTime: setTime ? f.startTime || "09:00" : "",
                  endTime: setTime ? f.endTime || "17:00" : "",
                }));
              }}
              className="h-4 w-4 rounded border-brand-darkBlue/20"
            />
            Set time (leave unchecked to block the full day)
          </label>

          {form.setTime && (
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="block text-sm font-medium text-brand-darkBlue/80">
                  Start time
                </span>
                <TimeSelect
                  label="Start time"
                  value={form.startTime}
                  onChange={(startTime) =>
                    setForm((f) => ({ ...f, startTime }))
                  }
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-brand-darkBlue/80">
                  End time
                </span>
                <TimeSelect
                  label="End time"
                  value={form.endTime}
                  onChange={(endTime) => setForm((f) => ({ ...f, endTime }))}
                />
              </div>
            </div>
          )}
        </div>

        <label className="block sm:col-span-2">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Reason (optional)
          </span>
          <input
            type="text"
            value={form.reason}
            onChange={(e) =>
              setForm((f) => ({ ...f, reason: e.target.value }))
            }
            placeholder="e.g. Doctor's appointment"
            className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>

        {error && (
          <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add block"}
          </button>
        </div>
      </form>

      {blocks.length === 0 ? (
        <p className="mt-4 text-sm text-brand-darkBlue/60">
          No unavailability blocks yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {blocks.map((block) => (
            <li
              key={block.id}
              className="flex items-center justify-between gap-2 rounded-md border border-brand-darkBlue/10 bg-white shadow-sm px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-brand-darkBlue">
                  {formatUnavailabilityLabel(block)}
                </p>
                {block.reason && (
                  <p className="mt-0.5 text-xs text-brand-darkBlue/60">
                    {block.reason}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(block.id)}
                disabled={deletingId === block.id}
                className="shrink-0 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deletingId === block.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
