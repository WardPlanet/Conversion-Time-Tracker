"use client";

import * as XLSX from "xlsx";
import type { TimeClockEvent } from "@/lib/types";
import { buildTimesheetExportRows } from "@/lib/domain/timesheet-export";

/** Builds a basic .xlsx (one row per raw clock event) for whatever date range the caller passes in, and triggers a browser download. */
export function ExportTimesheetButton({
  trainerName,
  from,
  to,
  events,
}: {
  trainerName: string;
  from: string; // "YYYY-MM-DD"
  to: string; // "YYYY-MM-DD"
  events: TimeClockEvent[];
}) {
  function handleExport() {
    const rows = buildTimesheetExportRows(events);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Time Clock");

    const safeName = trainerName.trim().replace(/\s+/g, "_");
    XLSX.writeFile(workbook, `${safeName}_TimeClock_${from}-${to}.xlsx`);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="rounded-md border border-brand-darkBlue/20 px-4 py-2 text-sm font-medium hover:bg-brand-blueWater"
    >
      Export Timesheet to Excel
    </button>
  );
}
