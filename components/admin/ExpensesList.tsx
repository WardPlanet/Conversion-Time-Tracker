"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { EnrichedExpense } from "@/lib/domain/expenses";

/** Central review queue — every trainer's currently "pending" expenses, with Approve/Reject actions. Rejecting requires a reason. */
export function ExpensesList({
  initialExpenses,
}: {
  initialExpenses: EnrichedExpense[];
}) {
  const [expenses, setExpenses] = useState(initialExpenses);

  async function refresh() {
    const response = await fetch("/api/admin/expenses");
    const data = await response.json();
    setExpenses(data.expenses ?? []);
  }

  if (expenses.length === 0) {
    return (
      <p className="text-sm text-brand-darkBlue/60">
        No expenses awaiting review.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {expenses.map((expense) => (
        <ExpenseCard key={expense.id} expense={expense} onDecided={refresh} />
      ))}
    </ul>
  );
}

function ExpenseCard({
  expense,
  onDecided,
}: {
  expense: EnrichedExpense;
  onDecided: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: "approved" | "rejected") {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          status === "rejected" ? { status, reason } : { status }
        ),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to update expense.");
        return;
      }

      setRejecting(false);
      onDecided();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/admin/trainers/${expense.trainerId}`}
            className="text-sm font-medium text-brand-blue hover:underline"
          >
            {expense.trainer?.name ?? "Unknown trainer"}
          </Link>
          <p className="mt-1 text-sm text-brand-darkBlue">
            {expense.category} — {formatCurrency(expense.amount)}
            {expense.project && ` · ${expense.project.name}`}
          </p>
          <p className="mt-1 text-xs text-brand-darkBlue/50">{expense.date}</p>
          <p className="mt-1 text-sm text-brand-darkBlue/70">
            “{expense.description}”
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        {!rejecting ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => decide("approved")}
              disabled={submitting}
              className="rounded-md bg-brand-green px-3 py-1 text-sm font-medium text-white hover:bg-brand-green/90 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={submitting}
              className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-sm hover:bg-brand-blueWater"
            >
              Reject
            </button>
          </div>
        ) : (
          <div className="w-56 shrink-0">
            <textarea
              rows={2}
              required
              placeholder="Reason (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="block w-full rounded-md border border-brand-darkBlue/20 px-2 py-1 text-xs shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => decide("rejected")}
                disabled={submitting || !reason.trim()}
                className="rounded-md bg-brand-blue px-3 py-1 text-xs font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
              >
                {submitting ? "Rejecting…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-xs hover:bg-brand-blueWater"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
