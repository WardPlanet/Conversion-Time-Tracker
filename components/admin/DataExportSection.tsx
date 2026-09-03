"use client";

import { Download } from "lucide-react";

const EXPORTS = [
  {
    key: "time-entries",
    label: "Time Entries",
    description: "All logged task entries — trainer, project, task, date, hours, location, office, note, billable status, and week submission status.",
  },
  {
    key: "expenses",
    label: "Expenses",
    description: "All expense submissions — trainer, project, category, amount, description, and approval status.",
  },
  {
    key: "timesheets",
    label: "Timesheets",
    description: "Weekly timesheet summaries — trainer, week, total hours worked, and submission status.",
  },
] as const;

export function DataExportSection() {
  function download(type: string) {
    window.location.href = `/api/admin/export?type=${type}`;
  }

  return (
    <section className="rounded-md border border-brand-darkBlue/10 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-medium">Data Export</h2>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        Download all data as CSV. Files are formatted to match the Monday.com board structure,
        so they can be imported directly once your boards are ready.
      </p>

      <div className="mt-4 space-y-3">
        {EXPORTS.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-start justify-between gap-4 rounded-md border border-brand-darkBlue/10 p-4"
          >
            <div>
              <p className="font-medium text-brand-darkBlue">{label}</p>
              <p className="mt-0.5 text-sm text-brand-darkBlue/60">{description}</p>
            </div>
            <button
              type="button"
              onClick={() => download(key)}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue"
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
