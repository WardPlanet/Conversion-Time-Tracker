import type { Expense, ExpenseCategory, Project, PublicUser } from "@/lib/types";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Travel",
  "Meals",
  "Supplies",
  "Mileage",
  "Other",
];

export type EnrichedExpense = Expense & {
  trainer: PublicUser | null;
  project: Project | null;
};

/** Joins each expense to its trainer and (optional) project — shared by the admin review queue and the trainer's own list. */
export function enrichExpenses(
  expenses: Expense[],
  trainers: PublicUser[],
  projects: Project[]
): EnrichedExpense[] {
  const trainersById = new Map(trainers.map((t) => [t.id, t]));
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  return expenses.map((expense) => ({
    ...expense,
    trainer: trainersById.get(expense.trainerId) ?? null,
    project: expense.projectId
      ? projectsById.get(expense.projectId) ?? null
      : null,
  }));
}
