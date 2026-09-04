"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { FavoriteTask } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { ChangePasswordSection } from "@/components/shared/ChangePasswordSection";

export default function TrainerSettingsPage() {
  const [favorites, setFavorites] = useState<FavoriteTask[]>([]);
  const [taskNames, setTaskNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskName, setNewTaskName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/trainer/favorites");
    const data = await response.json();
    setFavorites(data.favorites ?? []);
    setTaskNames(data.taskNames ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!newTaskName.trim()) {
      setError("Enter a task name.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/trainer/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName: newTaskName }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to add favorite.");
        return;
      }

      setNewTaskName("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(favoriteId: string) {
    setError(null);
    setRemovingId(favoriteId);
    try {
      const response = await fetch(`/api/trainer/favorites/${favoriteId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to remove favorite.");
        return;
      }

      await load();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Settings</h1>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        Manage your account preferences.
      </p>

      <section className="mt-6 rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6">
        <h2 className="text-lg font-medium">Favorite tasks</h2>
        <p className="mt-1 text-sm text-brand-darkBlue/60">
          Shortcuts shown on the Task Tracker for quickly starting a new
          entry.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-brand-darkBlue/60">Loading…</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {favorites.length === 0 && (
              <li className="text-sm text-brand-darkBlue/60">No favorites yet.</li>
            )}
            {favorites.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between rounded-md border border-brand-darkBlue/10 px-3 py-2"
              >
                <span className="text-sm text-brand-darkBlue">{f.taskName}</span>
                <button
                  onClick={() => handleRemove(f.id)}
                  disabled={removingId === f.id}
                  className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {removingId === f.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <input
            type="text"
            list="favorite-task-name-suggestions"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="Task name (e.g. Onboarding call)"
            className="flex-1 rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <datalist id="favorite-task-name-suggestions">
            {taskNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add favorite"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      <ChangePasswordSection endpoint="/api/trainer/change-password" />
    </div>
  );
}
