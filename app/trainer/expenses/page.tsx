"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ExpenseCategory, Project } from "@/lib/types";
import type { EnrichedExpense } from "@/lib/domain/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/domain/expenses";
import { ExpenseStatusTag } from "@/components/trainer/badges";
import { formatCurrency, toLocalDateString } from "@/lib/format";
import { useToast } from "@/components/ToastProvider";

function emptyForm(defaultDate: string) {
  return {
    projectId: "",
    date: defaultDate,
    category: EXPENSE_CATEGORIES[0],
    amount: "",
    description: "",
  };
}

export default function TrainerExpensesPage() {
  const [expenses, setExpenses] = useState<EnrichedExpense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(() =>
    emptyForm(toLocalDateString(new Date()))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    const response = await fetch("/api/trainer/expenses");
    const data = await response.json();
    setExpenses(data.expenses ?? []);
    setProjects(data.projects ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(expense: EnrichedExpense) {
    setEditingId(expense.id);
    setForm({
      projectId: expense.projectId ?? "",
      date: expense.date,
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm(toLocalDateString(new Date())));
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const amount = parseFloat(form.amount);
    if (!form.date) {
      setError("Date is required.");
      return;
    }
    if (!(amount > 0)) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    if (!form.description.trim()) {
      setError("A description is required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        projectId: form.projectId || undefined,
        date: form.date,
        category: form.category,
        amount,
        description: form.description,
      };
      const response = editingId
        ? await fetch(`/api/trainer/expenses/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/trainer/expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to submit expense.");
        return;
      }

      const wasEditing = editingId !== null;
      cancelEdit();
      await load();
      showToast({
        message: wasEditing ? "Expense resubmitted." : "Expense submitted.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Expenses</h1>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        Submit out-of-pocket expenses for reimbursement.
      </p>

      <section className="mt-6 rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6">
        <h2 className="text-lg font-medium">
          {editingId ? "Edit expense" : "Submit a new expense"}
        </h2>
        <form
          onSubmit={handleSubmit}
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <label className="block">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Date
            </span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) =>
                setForm((f) => ({ ...f, date: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Project (optional)
            </span>
            <select
              value={form.projectId}
              onChange={(e) =>
                setForm((f) => ({ ...f, projectId: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            >
              <option value="">No specific project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Category
            </span>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as ExpenseCategory,
                }))
              }
              className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Amount
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              placeholder="0.00"
              className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="block text-sm font-medium text-brand-darkBlue/80">
              Description
            </span>
            <textarea
              rows={3}
              required
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="What was this expense for?"
              className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>

          {/* Reserved spot for a future receipt-upload feature — file storage isn't decided yet, so no upload UI here. */}
          <div className="sm:col-span-2 rounded-md border border-dashed border-brand-darkBlue/20 px-3 py-2 text-xs text-brand-darkBlue/40">
            Receipt attachment — coming soon.
          </div>

          {error && (
            <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
          )}

          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
            >
              {submitting
                ? "Submitting…"
                : editingId
                  ? "Resubmit expense"
                  : "Submit expense"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-md border border-brand-darkBlue/20 px-4 py-2 text-sm hover:bg-brand-blueWater"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Your expenses</h2>
        {loading ? (
          <p className="mt-3 text-sm text-brand-darkBlue/60">Loading…</p>
        ) : expenses.length === 0 ? (
          <p className="mt-3 text-sm text-brand-darkBlue/60">
            No expenses submitted yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="flex items-center gap-2 text-sm font-medium text-brand-darkBlue">
                      {expense.category} — {formatCurrency(expense.amount)}
                      <ExpenseStatusTag status={expense.status} />
                    </span>
                    <p className="mt-1 text-xs text-brand-darkBlue/50">
                      {expense.date}
                      {expense.project && ` · ${expense.project.name}`}
                    </p>
                    <p className="mt-1 text-sm text-brand-darkBlue/70">
                      “{expense.description}”
                    </p>
                    {expense.status === "rejected" &&
                      expense.rejectionReason && (
                        <p className="mt-1 text-xs text-red-600">
                          Rejected: {expense.rejectionReason}
                        </p>
                      )}
                  </div>
                  {expense.status === "rejected" && (
                    <button
                      type="button"
                      onClick={() => startEdit(expense)}
                      className="shrink-0 rounded-md border border-brand-darkBlue/20 px-3 py-1 text-sm hover:bg-brand-blueWater"
                    >
                      Edit & resubmit
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
