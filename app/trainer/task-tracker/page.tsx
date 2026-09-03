"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import type {
  Booking,
  FavoriteTask,
  Office,
  Project,
  Task,
  WeeklySubmission,
} from "@/lib/types";
import { CalendarNav } from "@/components/calendar/CalendarNav";
import { WeeklyTaskGrid } from "@/components/task-tracker/WeeklyTaskGrid";
import { WeekSubmittedBanner } from "@/components/task-tracker/WeekSubmittedBanner";
import { Modal } from "@/components/Modal";
import { StatCard } from "@/components/StatCard";
import {
  TaskEntryFields,
  type TaskEntryFieldValues,
} from "@/components/trainer/TaskEntryFields";
import { formatDateRange, formatHours, toLocalDateString } from "@/lib/format";
import { parseHoursInput } from "@/lib/domain/hours-input";
import { displayTaskTitle } from "@/lib/domain/tasks";
import {
  filterEntriesForWeek,
  getBusinessWeekDays,
  isDateInWeek,
  nextBusinessWeek,
  previousBusinessWeek,
  sumHours,
  type EnrichedTaskEntry,
} from "@/lib/domain/task-entry-grid";
import {
  computeWeekLockState,
  findWeekSubmission,
  weekStartDateFor,
} from "@/lib/domain/weekly-submissions";

function todayLocalDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyForm() {
  return {
    date: todayLocalDate(),
    projectId: "",
    office: "",
    taskId: "",
    note: "",
    hours: "",
    location: "",
    bookingId: "",
    markComplete: false,
  };
}

/**
 * Editor for a single existing entry, opened from the weekly grid. An entry
 * is only editable when its week isn't locked — either it's outside the
 * current business week (the normal rule), or its week was submitted or
 * approved (the new submission-lock layer) — enforced here for the UI and
 * (authoritatively) in `store.updateTaskEntry`.
 */
function EntryEditor({
  entry,
  projects,
  offices,
  tasks,
  editable,
  lockMessage,
  onSaved,
}: {
  entry: EnrichedTaskEntry;
  projects: Project[];
  offices: Office[];
  tasks: Task[];
  editable: boolean;
  lockMessage: string;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<TaskEntryFieldValues>({
    projectId: entry.projectId,
    office: entry.office,
    taskId: entry.taskId,
    hours: String(entry.hours),
    note: entry.note,
    location: entry.location ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!editable) {
    return (
      <div>
        <p className="rounded-md border border-brand-orange/30 bg-brand-orange/10 p-3 text-sm text-brand-orange">
          {lockMessage}
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-brand-darkBlue/80">Date</dt>
            <dd className="text-brand-darkBlue/70">{entry.date}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-darkBlue/80">Project</dt>
            <dd className="text-brand-darkBlue/70">
              {entry.project?.name ?? "Unknown project"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-brand-darkBlue/80">Office</dt>
            <dd className="text-brand-darkBlue/70">{entry.office}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-darkBlue/80">Task</dt>
            <dd className="text-brand-darkBlue/70">
              {entry.task ? displayTaskTitle(entry.task) : "Unknown task"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-brand-darkBlue/80">Hours</dt>
            <dd className="text-brand-darkBlue/70">{formatHours(entry.hours)}</dd>
          </div>
          {entry.location && (
            <div>
              <dt className="font-medium text-brand-darkBlue/80">Location</dt>
              <dd className="text-brand-darkBlue/70">{entry.location}</dd>
            </div>
          )}
          <div>
            <dt className="font-medium text-brand-darkBlue/80">Note</dt>
            <dd className="whitespace-pre-wrap text-brand-darkBlue/70">
              {entry.note}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

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
      const response = await fetch(`/api/trainer/task-entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: values.projectId,
          office: values.office,
          taskId: values.taskId,
          note: values.note,
          hours,
          location: values.location || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to update task entry.");
        return;
      }

      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      const response = await fetch(`/api/trainer/task-entries/${entry.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setDeleteError(data?.error ?? "Failed to delete task entry.");
        return;
      }
      onSaved();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <p className="text-sm text-brand-darkBlue/60 sm:col-span-2">{entry.date}</p>
      <TaskEntryFields
        projects={projects}
        offices={offices}
        tasks={tasks}
        value={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        disabled={submitting}
      />
      {error && (
        <p className="text-sm text-red-600 sm:col-span-2">{error}</p>
      )}
      {deleteError && (
        <p className="text-sm text-red-600 sm:col-span-2">{deleteError}</p>
      )}
      <div className="flex items-center justify-between gap-2 sm:col-span-2">
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={submitting || deleting}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete entry
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-brand-darkBlue/70">
              Delete this entry?
            </span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm hover:bg-brand-blueWater disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || deleting}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export default function TaskTrackerPage() {
  const [entries, setEntries] = useState<EnrichedTaskEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [favorites, setFavorites] = useState<FavoriteTask[]>([]);
  const [submissions, setSubmissions] = useState<WeeklySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingWeek, setSubmittingWeek] = useState(false);
  const [weekCursor, setWeekCursor] = useState(() => new Date());
  const [editingEntry, setEditingEntry] = useState<EnrichedTaskEntry | null>(
    null
  );
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [taskNameHint, setTaskNameHint] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    key: number;
    totalHours: number;
    entryCount: number;
    projectCount: number;
  } | null>(null);

  const dismissCelebration = useCallback(() => setCelebration(null), []);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/trainer/task-entries");
    const data = await response.json();
    setEntries(data.entries ?? []);
    setProjects(data.projects ?? []);
    setOffices(data.offices ?? []);
    setTasks(data.tasks ?? []);
    setBookings(data.bookings ?? []);
    setLoading(false);
  }

  async function loadFavorites() {
    const response = await fetch("/api/trainer/favorites");
    const data = await response.json();
    setFavorites(data.favorites ?? []);
  }

  async function loadSubmissions() {
    const response = await fetch("/api/trainer/weekly-submissions");
    const data = await response.json();
    setSubmissions(data.submissions ?? []);
  }

  useEffect(() => {
    load();
    loadFavorites();
    loadSubmissions();
  }, []);

  // A favorite is just a task *name* — once the trainer picks a project in
  // the Add Entry form, try to match it to that project's own task with the
  // same title. No match just leaves Task for the trainer to pick normally.
  useEffect(() => {
    if (!taskNameHint || !form.projectId || form.taskId) return;
    const match = tasks.find(
      (t) =>
        t.projectId === form.projectId &&
        t.title.toLowerCase() === taskNameHint.toLowerCase()
    );
    if (match) {
      setForm((f) => ({ ...f, taskId: match.id }));
    }
  }, [taskNameHint, form.projectId, form.taskId, tasks]);

  function openAddEntry() {
    setForm(emptyForm());
    setTaskNameHint(null);
    setError(null);
    setAddEntryOpen(true);
  }

  function openAddEntryFromFavorite(taskName: string) {
    setForm(emptyForm());
    setTaskNameHint(taskName);
    setError(null);
    setAddEntryOpen(true);
  }

  function openAddEntryForDay(day: Date) {
    setForm({ ...emptyForm(), date: toLocalDateString(day) });
    setTaskNameHint(null);
    setError(null);
    setAddEntryOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.note.trim()) {
      setError("A note is required.");
      return;
    }

    const hours = parseHoursInput(form.hours);
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
      const response = await fetch("/api/trainer/task-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          projectId: form.projectId,
          office: form.office,
          taskId: form.taskId,
          note: form.note,
          hours,
          location: form.location || undefined,
          bookingId: form.bookingId || undefined,
          markComplete: form.markComplete,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to log task entry.");
        return;
      }

      setForm(emptyForm());
      setTaskNameHint(null);
      setAddEntryOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickAdd(input: {
    project: Project;
    date: string;
    office: string;
    taskId: string;
    hours: number;
    note: string;
    location?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch("/api/trainer/task-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: input.date,
        projectId: input.project.id,
        office: input.office,
        taskId: input.taskId,
        note: input.note,
        hours: input.hours,
        location: input.location || undefined,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      return { ok: false, error: data.error ?? "Failed to log task entry." };
    }

    await load();
    return { ok: true };
  }

  async function handleSubmitWeek() {
    setSubmittingWeek(true);
    try {
      const response = await fetch("/api/trainer/weekly-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStartDate: currentWeekStart }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to submit week.");
        return;
      }

      setError(null);
      await loadSubmissions();
      setCelebration({
        key: Date.now(),
        totalHours: weekTotalHours,
        entryCount: entriesThisWeek.length,
        projectCount: loggedProjectIds.size,
      });
    } finally {
      setSubmittingWeek(false);
    }
  }

  /** Whether `date` is editable — the current-week rule, unless its week's submission overrides that (locked either way, or unlocked by rejection even for a past week). */
  function isEntryEditable(date: string): boolean {
    const weekStart = weekStartDateFor(date);
    const submission = findWeekSubmission(submissions, weekStart);
    const lockState = computeWeekLockState(submission);
    if (lockState === "locked") return false;
    if (lockState === "unlocked_by_rejection") return true;
    return isDateInWeek(date, getBusinessWeekDays(new Date()));
  }

  const weekdays = getBusinessWeekDays(weekCursor);
  const entriesThisWeek = filterEntriesForWeek(entries, weekdays);
  const loggedProjectIds = new Set(entriesThisWeek.map((e) => e.projectId));
  const gridProjects = projects.filter((p) => loggedProjectIds.has(p.id));
  const weekTotalHours = sumHours(entriesThisWeek);

  const currentWeekStart = toLocalDateString(weekdays[0]);
  const currentSubmission = findWeekSubmission(submissions, currentWeekStart);
  const weekLockState = computeWeekLockState(currentSubmission);
  const weekStatus = currentSubmission?.status ?? "draft";
  const canSubmitWeek = weekStatus === "draft" || weekStatus === "rejected";

  const isEditingEntryEditable = editingEntry
    ? isEntryEditable(editingEntry.date)
    : false;
  const editingEntryLockMessage =
    weekLockState === "locked"
      ? "This week has been submitted for review and is locked."
      : "Past weeks are locked — this entry can no longer be edited.";

  const bookingsForSelectedProject = form.projectId
    ? bookings.filter((b) => b.projectId === form.projectId)
    : bookings;
  const selectedTask = tasks.find((t) => t.id === form.taskId) ?? null;

  return (
    <div>
      {celebration && (
        <WeekSubmittedBanner
          key={celebration.key}
          totalHours={celebration.totalHours}
          entryCount={celebration.entryCount}
          projectCount={celebration.projectCount}
          onDismiss={dismissCelebration}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-blue">Task Tracker</h1>
          <p className="mt-1 text-sm text-brand-darkBlue/60">
            Log what you worked on each day.
          </p>
        </div>
        <button
          onClick={openAddEntry}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
        >
          + Add Entry
        </button>
      </div>

      <div className="mt-4 w-full sm:w-56">
        <StatCard
          label="Total hours logged"
          value={formatHours(weekTotalHours)}
        />
      </div>

      {favorites.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-brand-darkBlue/80">
            Favorites:
          </span>
          {favorites.map((f) => (
            <button
              key={f.id}
              onClick={() => openAddEntryFromFavorite(f.taskName)}
              className="flex items-center gap-1.5 rounded-full border border-brand-orange/30 bg-brand-orange/10 px-3 py-1 text-sm font-medium text-brand-orange hover:bg-brand-orange/20"
            >
              <Star className="h-3.5 w-3.5 fill-brand-orange text-brand-orange" />
              {f.taskName}
            </button>
          ))}
        </div>
      )}

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">This week</h2>
          <div className="flex items-center gap-3">
            <CalendarNav
              label={`${weekdays[0].getMonth() + 1}/${weekdays[0].getDate()} – ${
                weekdays[4].getMonth() + 1
              }/${weekdays[4].getDate()}`}
              onPrev={() => setWeekCursor((c) => previousBusinessWeek(c))}
              onNext={() => setWeekCursor((c) => nextBusinessWeek(c))}
              onToday={() => setWeekCursor(new Date())}
              todayLabel="This week"
            />
            {canSubmitWeek && (
              <button
                onClick={handleSubmitWeek}
                disabled={submittingWeek}
                className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
              >
                {submittingWeek
                  ? "Submitting…"
                  : weekStatus === "rejected"
                    ? "Resubmit week"
                    : "Submit week"}
              </button>
            )}
          </div>
        </div>

        {weekStatus === "submitted" && (
          <p className="mt-3 rounded-md border border-brand-orange/30 bg-brand-orange/10 p-3 text-sm text-brand-orange">
            Submitted — awaiting review.
          </p>
        )}
        {weekStatus === "approved" && (
          <p className="mt-3 rounded-md border border-brand-green/30 bg-brand-green/10 p-3 text-sm text-brand-green">
            Approved.
          </p>
        )}
        {weekStatus === "rejected" && currentSubmission && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Rejected: {currentSubmission.rejectionReason} — please revise and
            resubmit.
          </p>
        )}

        {loading ? (
          <p className="mt-3 text-sm text-brand-darkBlue/60">Loading…</p>
        ) : (
          <WeeklyTaskGrid
            projects={gridProjects}
            weekdays={weekdays}
            entries={entriesThisWeek}
            offices={offices}
            tasks={tasks}
            onEntryClick={setEditingEntry}
            onQuickAdd={weekLockState === "locked" ? undefined : handleQuickAdd}
            onAddEntryForDay={
              weekLockState === "locked" ? undefined : openAddEntryForDay
            }
          />
        )}
      </section>

      <Modal
        open={addEntryOpen}
        onClose={() => setAddEntryOpen(false)}
        title="Add task entry"
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <label className="block">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Date
            </span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>

          <TaskEntryFields
            projects={projects}
            offices={offices}
            tasks={tasks}
            value={{
              projectId: form.projectId,
              office: form.office,
              taskId: form.taskId,
              hours: form.hours,
              note: form.note,
              location: form.location,
            }}
            onChange={(patch) =>
              setForm((f) => ({
                ...f,
                ...patch,
                // The previous booking/mark-complete choice may not apply
                // once the project (and therefore its tasks) changes.
                ...(patch.projectId !== undefined
                  ? { bookingId: "", markComplete: false }
                  : {}),
              }))
            }
            disabled={submitting}
          />

          {taskNameHint && !form.taskId && (
            <p className="text-xs text-brand-darkBlue/60 sm:col-span-2">
              Favorite &quot;{taskNameHint}&quot; — pick a project with a
              matching task to auto-select it, or choose a different task
              manually.
            </p>
          )}

          <label className="block sm:col-span-2">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Booking (optional)
            </span>
            <select
              value={form.bookingId}
              onChange={(e) =>
                setForm((f) => ({ ...f, bookingId: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            >
              <option value="">Not tied to a specific booking</option>
              {bookingsForSelectedProject.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} ({formatDateRange(b.startTime, b.endTime)})
                </option>
              ))}
            </select>
          </label>

          {selectedTask && selectedTask.status !== "completed" && (
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.markComplete}
                onChange={(e) =>
                  setForm((f) => ({ ...f, markComplete: e.target.checked }))
                }
                className="h-4 w-4 rounded border-brand-darkBlue/20"
              />
              <span className="text-sm text-brand-darkBlue/80">
                Mark this task complete
              </span>
            </label>
          )}

          {error && (
            <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
            >
              {submitting ? "Logging…" : "Log entry"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editingEntry !== null}
        onClose={() => setEditingEntry(null)}
        title={isEditingEntryEditable ? "Edit task entry" : "Task entry"}
      >
        {editingEntry && (
          <EntryEditor
            entry={editingEntry}
            projects={projects}
            offices={offices}
            tasks={tasks}
            editable={isEditingEntryEditable}
            lockMessage={editingEntryLockMessage}
            onSaved={() => {
              setEditingEntry(null);
              load();
              loadSubmissions();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
