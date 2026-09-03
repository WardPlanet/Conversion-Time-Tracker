"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { FileText, Plus } from "lucide-react";
import { ProjectDot } from "@/components/trainer/badges";
import {
  TaskEntryFields,
  type TaskEntryFieldValues,
} from "@/components/trainer/TaskEntryFields";
import { formatHours, toLocalDateString } from "@/lib/format";
import { parseHoursInput } from "@/lib/domain/hours-input";
import { displayTaskTitle } from "@/lib/domain/tasks";
import {
  groupEntriesByProjectAndDate,
  sumHoursByDate,
  type EnrichedTaskEntry,
} from "@/lib/domain/task-entry-grid";
import type { Office, Project, Task } from "@/lib/types";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const POPOVER_GAP = 6;

function EntryCard({
  entry,
  onClick,
}: {
  entry: EnrichedTaskEntry;
  onClick?: (entry: EnrichedTaskEntry) => void;
}) {
  return (
    <div
      onClick={onClick ? () => onClick(entry) : undefined}
      className={`rounded border border-brand-darkBlue/10 bg-brand-blueWater p-2 text-xs ${
        onClick ? "cursor-pointer hover:border-brand-darkBlue/20 hover:bg-brand-blueWater" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-brand-darkBlue">
          {entry.task ? displayTaskTitle(entry.task) : "Unknown task"}
        </p>
        <span className="shrink-0 text-brand-darkBlue/60">
          {formatHours(entry.hours)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-brand-darkBlue/60">{entry.office}</p>
        {entry.note && (
          <span
            title={entry.note}
            aria-label={`Note: ${entry.note}`}
            className="shrink-0 text-brand-darkBlue/40"
          >
            <FileText className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}

/** Clamps a popover of `size` anchored to `anchor` so it never renders off-screen, flipping above/below and left/right as needed. */
function computePopoverPosition(
  anchor: DOMRect,
  size: { width: number; height: number },
  viewport: { width: number; height: number }
) {
  const spaceBelow = viewport.height - anchor.bottom;
  const spaceAbove = anchor.top;
  const top =
    spaceBelow >= size.height + POPOVER_GAP || spaceBelow >= spaceAbove
      ? anchor.bottom + POPOVER_GAP
      : anchor.top - size.height - POPOVER_GAP;

  let left = anchor.left;
  if (left + size.width > viewport.width - POPOVER_GAP) {
    left = anchor.right - size.width;
  }

  return {
    top: Math.max(
      POPOVER_GAP,
      Math.min(top, viewport.height - size.height - POPOVER_GAP)
    ),
    left: Math.max(
      POPOVER_GAP,
      Math.min(left, viewport.width - size.width - POPOVER_GAP)
    ),
  };
}

/**
 * Quick-add popover for an empty grid cell. Project and date are fixed by
 * the cell clicked (row/column) — only office/task/hours/note are editable,
 * pre-filled from that project's most recently logged entry this week.
 */
function QuickAddPopover({
  project,
  day,
  offices,
  tasks,
  prefill,
  anchorRect,
  onClose,
  onSave,
}: {
  project: Project;
  day: Date;
  offices: Office[];
  tasks: Task[];
  prefill: { office: string; taskId: string };
  anchorRect: DOMRect;
  onClose: () => void;
  onSave: (input: {
    office: string;
    taskId: string;
    hours: number;
    note: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [values, setValues] = useState<TaskEntryFieldValues>({
    projectId: project.id,
    office: prefill.office,
    taskId: prefill.taskId,
    hours: "",
    note: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition(
      computePopoverPosition(
        anchorRect,
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight }
      )
    );
  }, [anchorRect]);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!values.note.trim()) {
      setError("A note is required.");
      return;
    }
    const hours = parseHoursInput(values.hours);
    if (hours === null) {
      setError("Enter hours like 2h, 45m, 1h 30m, or 2.5.");
      return;
    }
    if (!(hours > 0)) {
      setError("Hours must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSave({
        office: values.office,
        taskId: values.taskId,
        hours,
        note: values.note,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to log task entry.");
        return;
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
      className="z-50 w-72 rounded-md border border-brand-darkBlue/10 bg-white p-4 shadow-lg"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-darkBlue">
          {project.name} · {toLocalDateString(day)}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel"
          className="text-brand-darkBlue/50 hover:text-brand-darkBlue/70"
        >
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <TaskEntryFields
          projects={[project]}
          offices={offices}
          tasks={tasks}
          value={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          disabled={submitting}
          hideProject
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm hover:bg-brand-blueWater"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Project-rows/weekday-columns grid of already-logged {@link EnrichedTaskEntry}
 * records for a single Monday–Friday week. Purely presentational — callers
 * own the week cursor and pass in whichever `weekdays` (5 `Date`s) and
 * `entries` should be visible; grouping happens here so no caller has to
 * duplicate the project+date bucketing.
 */
export function WeeklyTaskGrid({
  projects,
  weekdays,
  entries,
  offices,
  tasks,
  onEntryClick,
  onQuickAdd,
  onAddEntryForDay,
  emptyStateMessage = "No entries logged this week.",
}: {
  projects: Project[];
  weekdays: Date[];
  entries: EnrichedTaskEntry[];
  /** Needed only when `onQuickAdd` is provided, to populate the quick-add popover's Office/Task selects. */
  offices?: Office[];
  tasks?: Task[];
  /** Called when an existing entry card is clicked — e.g. to open it for editing. */
  onEntryClick?: (entry: EnrichedTaskEntry) => void;
  /** Called when the quick-add popover's Save button is submitted for an empty cell. */
  onQuickAdd?: (input: {
    project: Project;
    date: string;
    office: string;
    taskId: string;
    hours: number;
    note: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Called when a cell in the trailing "add new" row is clicked — opens the
   * full Add Entry form (project included) pre-filled with that day. Only
   * provided where adding an entry is actually possible; omitted entirely
   * for read-only callers, which keeps the plain `emptyStateMessage` instead.
   */
  onAddEntryForDay?: (day: Date) => void;
  /** Shown inside the grid body when `projects` is empty (no entries this week) AND `onAddEntryForDay` isn't provided — the frame (headers, Total row) still renders regardless. Callers with an "Add Entry" affordance elsewhere on the page can customize the wording. */
  emptyStateMessage?: string;
}) {
  const entriesByProjectAndDate = groupEntriesByProjectAndDate(entries);
  const [quickAddTarget, setQuickAddTarget] = useState<{
    project: Project;
    day: Date;
    anchorRect: DOMRect;
  } | null>(null);

  const canQuickAdd = Boolean(onQuickAdd && offices && tasks);
  const dailyTotals = sumHoursByDate(entries);

  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-brand-darkBlue/10 bg-white shadow-sm">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-darkBlue/10 bg-brand-blueWater">
            <th className="w-40 px-3 py-2 text-left font-medium text-brand-darkBlue/60">
              Project
            </th>
            {weekdays.map((day, i) => (
              <th
                key={toLocalDateString(day)}
                className="px-3 py-2 text-left font-medium text-brand-darkBlue/60"
              >
                {WEEKDAY_LABELS[i]}{" "}
                <span className="font-normal text-brand-darkBlue/50">
                  {day.getMonth() + 1}/{day.getDate()}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 && !onAddEntryForDay && (
            <tr>
              <td
                colSpan={weekdays.length + 1}
                className="px-3 py-6 text-center text-sm text-brand-darkBlue/50"
              >
                {emptyStateMessage}
              </td>
            </tr>
          )}
          {projects.map((project) => {
            const byDate = entriesByProjectAndDate.get(project.id);
            return (
              <tr
                key={project.id}
                className="border-b border-brand-darkBlue/10 last:border-b-0"
              >
                <td className="align-top px-3 py-3">
                  <div className="flex items-center gap-2">
                    <ProjectDot color={project.color} />
                    <span className="font-medium">{project.name}</span>
                  </div>
                </td>
                {weekdays.map((day) => {
                  const dayEntries =
                    byDate?.get(toLocalDateString(day)) ?? [];
                  return (
                    <td
                      key={toLocalDateString(day)}
                      className="align-top px-3 py-3"
                    >
                      {dayEntries.length === 0 ? (
                        canQuickAdd ? (
                          <button
                            type="button"
                            onClick={(e) =>
                              setQuickAddTarget({
                                project,
                                day,
                                anchorRect: e.currentTarget.getBoundingClientRect(),
                              })
                            }
                            aria-label={`Log a task entry for ${project.name} on ${toLocalDateString(day)}`}
                            className="flex h-full w-full items-center justify-center rounded py-1 text-brand-darkBlue/40 hover:bg-brand-blueWater hover:text-brand-darkBlue/50"
                          >
                            —
                          </button>
                        ) : (
                          <span className="text-brand-darkBlue/40">—</span>
                        )
                      ) : (
                        <div className="space-y-1.5">
                          {dayEntries.map((entry) => (
                            <EntryCard
                              key={entry.id}
                              entry={entry}
                              onClick={onEntryClick}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {onAddEntryForDay && (
            <tr className="border-t border-dashed border-brand-darkBlue/15">
              <td className="px-3 py-3" />
              {weekdays.map((day) => (
                <td key={toLocalDateString(day)} className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onAddEntryForDay(day)}
                    aria-label={`Add a task entry for ${toLocalDateString(day)}`}
                    className="group flex h-full w-full items-center justify-center rounded border border-dashed border-brand-darkBlue/15 py-2 hover:border-brand-blue/40 hover:bg-brand-blueWater"
                  >
                    <Plus className="h-3.5 w-3.5 text-brand-blue opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </td>
              ))}
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-brand-darkBlue/15 bg-brand-blueWater/60">
            <td className="px-3 py-2.5 font-semibold text-brand-darkBlue">
              Total
            </td>
            {weekdays.map((day) => (
              <td
                key={toLocalDateString(day)}
                className="px-3 py-2.5 font-semibold text-brand-darkBlue"
              >
                {formatHours(dailyTotals.get(toLocalDateString(day)) ?? 0)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>

      {quickAddTarget && onQuickAdd && offices && tasks && (
        <QuickAddPopover
          project={quickAddTarget.project}
          day={quickAddTarget.day}
          offices={offices}
          tasks={tasks}
          anchorRect={quickAddTarget.anchorRect}
          prefill={(() => {
            // Most recently logged entry for this project, this week —
            // there's always at least one, since that's what puts the
            // project row in the grid at all.
            const projectEntries = (
              entriesByProjectAndDate.get(quickAddTarget.project.id) ??
              new Map<string, EnrichedTaskEntry[]>()
            );
            const all = Array.from(projectEntries.values()).flat();
            const mostRecent = [...all].sort(
              (a, b) =>
                b.date.localeCompare(a.date) ||
                b.createdAt.localeCompare(a.createdAt)
            )[0];
            return {
              office: mostRecent?.office ?? "",
              taskId: mostRecent?.taskId ?? "",
            };
          })()}
          onClose={() => setQuickAddTarget(null)}
          onSave={(input) =>
            onQuickAdd({
              project: quickAddTarget.project,
              date: toLocalDateString(quickAddTarget.day),
              ...input,
            })
          }
        />
      )}
    </div>
  );
}
