/**
 * One entry in the standard checklist. `key` exists only to give the UI a
 * stable, unique selection identity — two entries below share the title
 * "On-Site Customer Support" (billable vs. non-billable), so `title` alone
 * can't serve as a key. `key` is never stored on the resulting `Task`.
 */
export interface StandardTaskTemplate {
  key: string;
  title: string;
  billable: boolean;
}

/**
 * The standard 5-task checklist every project's trainers are seeded with,
 * and the same list offered when assigning tasks to a trainer at project
 * creation — identical regardless of product line.
 */
export const STANDARD_TASKS: StandardTaskTemplate[] = [
  { key: "on_site_training", title: "On-Site Training", billable: true },
  {
    key: "virtual_customer_support",
    title: "Virtual Customer Support",
    billable: false,
  },
  {
    key: "on_site_customer_support_billable",
    title: "On-Site Customer Support",
    billable: true,
  },
  {
    key: "on_site_customer_support_non_billable",
    title: "On-Site Customer Support",
    billable: false,
  },
  { key: "virtual_training", title: "Virtual Training", billable: true },
];

/**
 * The title to display for a task — appends "(Non Billable)" when the task
 * isn't billable. This is purely a display convention: the stored `title`
 * never includes the suffix, so it stays consistent even if the label
 * wording changes later.
 */
export function displayTaskTitle(task: { title: string; billable: boolean }): string {
  return task.billable ? task.title : `${task.title} (Non Billable)`;
}
