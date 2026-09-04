"use client";

import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/PasswordField";
import { useToast } from "@/components/ToastProvider";

/** Change-password form usable by any role — pass the role-specific API endpoint. */
export function ChangePasswordSection({ endpoint }: { endpoint: string }) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to change password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast({ message: "Password changed." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6">
      <h2 className="text-lg font-medium">Change password</h2>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        Requires your current password.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 max-w-sm space-y-4">
        <PasswordField
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
        />
        <label className="block">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Confirm new password
          </span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
        >
          {submitting ? "Changing…" : "Change password"}
        </button>
      </form>
    </section>
  );
}
