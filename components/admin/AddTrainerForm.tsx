"use client";

import { useState, type FormEvent } from "react";
import type { PublicUser } from "@/lib/types";
import { PasswordField } from "@/components/PasswordField";

function emptyForm() {
  return { username: "", password: "", name: "", email: "" };
}

/** Add-trainer form, shared by the Trainers page and the dashboard's Quick Actions modal. */
export function AddTrainerForm({
  onCreated,
}: {
  onCreated?: (trainer: PublicUser) => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to add trainer.");
        return;
      }

      setForm(emptyForm());
      onCreated?.(data.trainer);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <Field
        label="Username"
        value={form.username}
        onChange={(v) => setForm((f) => ({ ...f, username: v }))}
      />
      <PasswordField
        label="Preset password"
        value={form.password}
        onChange={(v) => setForm((f) => ({ ...f, password: v }))}
        autoComplete="new-password"
      />
      <Field
        label="Name"
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
      />
      <Field
        label="Email"
        type="email"
        value={form.email}
        onChange={(v) => setForm((f) => ({ ...f, email: v }))}
      />

      {error && (
        <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add trainer"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-darkBlue/80">
        {label}
      </span>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
    </label>
  );
}
