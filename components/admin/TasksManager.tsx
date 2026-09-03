"use client";

import { useEffect, useState } from "react";
import type { PublicUser, Task } from "@/lib/types";
import { displayTaskTitle } from "@/lib/domain/tasks";

/**
 * Task checklist items are stored per-trainer (`Task.trainerId`), not
 * shared across a project — so authoring one here requires picking which
 * trainer(s) it applies to. Checking one box creates one Task row for that
 * trainer; checking several creates the same title for each in one submit.
 * Lives on that project's own profile page.
 */
export function TasksManager({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [trainers, setTrainers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [billable, setBillable] = useState(true);
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<Set<string>>(
    new Set()
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [tasksResponse, trainersResponse] = await Promise.all([
      fetch(`/api/admin/tasks?projectId=${projectId}`),
      fetch("/api/admin/trainers"),
    ]);
    const tasksData = await tasksResponse.json();
    const trainersData = await trainersResponse.json();
    setTasks(tasksData.tasks ?? []);
    setTrainers(trainersData.trainers ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function toggleTrainer(trainerId: string) {
    setSelectedTrainerIds((prev) => {
      const next = new Set(prev);
      if (next.has(trainerId)) next.delete(trainerId);
      else next.add(trainerId);
      return next;
    });
  }

  async function addTask() {
    const trimmed = title.trim();
    if (!trimmed || selectedTrainerIds.size === 0) return;

    setError(null);
    setSubmitting(true);
    try {
      for (const trainerId of selectedTrainerIds) {
        const response = await fetch("/api/admin/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            title: trimmed,
            billable,
            trainerId,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          setError(data?.error ?? "Failed to add task.");
          return;
        }
      }
      setTitle("");
      setBillable(true);
      setSelectedTrainerIds(new Set());
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function removeTask(taskId: string) {
    const response = await fetch(`/api/admin/tasks/${taskId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      await load();
    }
  }

  const trainersById = new Map(trainers.map((t) => [t.id, t]));

  return (
    <div>
      <h3 className="text-sm font-medium text-brand-darkBlue/80">
        Checklist tasks
      </h3>

      <div className="mt-2 space-y-2">
        <input
          type="text"
          placeholder="New task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <div className="flex items-center gap-4 text-sm text-brand-darkBlue/80">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="task-billable"
              checked={billable}
              onChange={() => setBillable(true)}
              className="h-3.5 w-3.5 border-brand-darkBlue/20"
            />
            Billable
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="task-billable"
              checked={!billable}
              onChange={() => setBillable(false)}
              className="h-3.5 w-3.5 border-brand-darkBlue/20"
            />
            Non-billable
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          {trainers.map((trainer) => (
            <label
              key={trainer.id}
              className="flex items-center gap-1.5 text-sm text-brand-darkBlue/80"
            >
              <input
                type="checkbox"
                checked={selectedTrainerIds.has(trainer.id)}
                onChange={() => toggleTrainer(trainer.id)}
                className="h-4 w-4 rounded border-brand-darkBlue/20"
              />
              {trainer.name}
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={addTask}
          disabled={submitting || !title.trim() || selectedTrainerIds.size === 0}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add task"}
        </button>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-brand-darkBlue/60">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="mt-3 text-sm text-brand-darkBlue/60">
          No checklist tasks yet for this project.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center justify-between rounded-md border border-brand-darkBlue/10 px-3 py-2"
            >
              <div>
                <span className="text-sm font-medium">
                  {displayTaskTitle(task)}
                </span>
                <span className="ml-2 text-xs text-brand-darkBlue/50">
                  {trainersById.get(task.trainerId)?.name ?? "Unknown trainer"}
                </span>
              </div>
              <button
                onClick={() => removeTask(task.id)}
                className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-sm hover:bg-brand-blueWater"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
