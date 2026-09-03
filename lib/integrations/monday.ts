/**
 * Monday.com integration service.
 *
 * Required env vars (add to .env.local):
 *   MONDAY_API_KEY            - Your Monday.com API v2 token
 *   MONDAY_BOARD_TIME_ENTRIES - Board ID for the Time Entries board
 *   MONDAY_BOARD_EXPENSES     - Board ID for the Expenses board
 *   MONDAY_BOARD_TIMESHEETS   - Board ID for the Timesheets board
 *
 * After creating your boards in Monday, update COLUMN_IDS below with the
 * actual column IDs (Board → Settings → Columns → right-click a column
 * header → "Copy column ID"). The defaults here are placeholders.
 */

const MONDAY_API_URL = "https://api.monday.com/v2";

const COLUMN_IDS = {
  timeEntries: {
    trainer: "text",
    project: "text1",
    task: "text2",
    date: "date",
    hours: "numbers",
    location: "text3",
    office: "text4",
    note: "long_text",
    billable: "checkbox",
    weekStatus: "status",
  },
  expenses: {
    trainer: "text",
    project: "text1",
    date: "date",
    category: "status",
    amount: "numbers",
    description: "long_text",
    status: "status1",
    rejectionReason: "text2",
    submittedAt: "date1",
  },
  timesheets: {
    trainer: "text",
    weekStart: "date",
    totalHours: "numbers",
    breakHours: "numbers1",
    status: "status",
    submittedAt: "date1",
  },
};

export function isMondayConfigured(): boolean {
  return Boolean(
    process.env.MONDAY_API_KEY &&
      process.env.MONDAY_BOARD_TIME_ENTRIES &&
      process.env.MONDAY_BOARD_EXPENSES &&
      process.env.MONDAY_BOARD_TIMESHEETS
  );
}

export function mondayConfigStatus(): {
  configured: boolean;
  missing: string[];
} {
  const required = [
    ["MONDAY_API_KEY", process.env.MONDAY_API_KEY],
    ["MONDAY_BOARD_TIME_ENTRIES", process.env.MONDAY_BOARD_TIME_ENTRIES],
    ["MONDAY_BOARD_EXPENSES", process.env.MONDAY_BOARD_EXPENSES],
    ["MONDAY_BOARD_TIMESHEETS", process.env.MONDAY_BOARD_TIMESHEETS],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k as string);
  return { configured: missing.length === 0, missing };
}

async function mondayRequest(gql: string): Promise<{ data?: unknown; errors?: { message: string }[] }> {
  const key = process.env.MONDAY_API_KEY;
  if (!key) throw new Error("MONDAY_API_KEY is not set.");
  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ query: gql }),
  });
  return res.json();
}

async function createItem(
  boardId: string,
  itemName: string,
  columnValues: Record<string, unknown>
): Promise<string> {
  const valuesJson = JSON.stringify(JSON.stringify(columnValues));
  const gql = `mutation {
    create_item(
      board_id: ${boardId},
      item_name: ${JSON.stringify(itemName)},
      column_values: ${valuesJson}
    ) { id }
  }`;
  const result = await mondayRequest(gql);
  const data = result.data as { create_item?: { id: string } } | undefined;
  return data?.create_item?.id ?? "";
}

// ── Row types (match the recommended board structure) ──────────────────────

export interface MondayTimeEntryRow {
  itemName: string;
  trainer: string;
  project: string;
  task: string;
  date: string;
  hours: number;
  location: string;
  office: string;
  note: string;
  billable: boolean;
  weekStatus: string;
}

export interface MondayExpenseRow {
  itemName: string;
  trainer: string;
  project: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  status: string;
  rejectionReason: string;
  submittedAt: string;
}

export interface MondayTimesheetRow {
  itemName: string;
  trainer: string;
  weekStart: string;
  totalHours: number;
  breakHours: number;
  status: string;
  submittedAt: string;
}

export interface SyncResult {
  success: boolean;
  configured: boolean;
  timeEntries: { synced: number; errors: number };
  expenses: { synced: number; errors: number };
  timesheets: { synced: number; errors: number };
  timestamp: string;
  message: string;
}

// ── Main sync function ─────────────────────────────────────────────────────

export async function syncAll(
  timeEntries: MondayTimeEntryRow[],
  expenses: MondayExpenseRow[],
  timesheets: MondayTimesheetRow[]
): Promise<SyncResult> {
  if (!isMondayConfigured()) {
    return {
      success: false,
      configured: false,
      timeEntries: { synced: 0, errors: 0 },
      expenses: { synced: 0, errors: 0 },
      timesheets: { synced: 0, errors: 0 },
      timestamp: new Date().toISOString(),
      message:
        "Monday.com is not configured. Add MONDAY_API_KEY, MONDAY_BOARD_TIME_ENTRIES, MONDAY_BOARD_EXPENSES, and MONDAY_BOARD_TIMESHEETS to your .env.local file.",
    };
  }

  const teBoard = process.env.MONDAY_BOARD_TIME_ENTRIES!;
  const expBoard = process.env.MONDAY_BOARD_EXPENSES!;
  const tsBoard = process.env.MONDAY_BOARD_TIMESHEETS!;
  const c = COLUMN_IDS;

  let teSync = 0, teErr = 0;
  let expSync = 0, expErr = 0;
  let tsSync = 0, tsErr = 0;

  for (const row of timeEntries) {
    try {
      await createItem(teBoard, row.itemName, {
        [c.timeEntries.trainer]: row.trainer,
        [c.timeEntries.project]: row.project,
        [c.timeEntries.task]: row.task,
        [c.timeEntries.date]: { date: row.date },
        [c.timeEntries.hours]: row.hours,
        [c.timeEntries.location]: row.location,
        [c.timeEntries.office]: row.office,
        [c.timeEntries.note]: { text: row.note },
        [c.timeEntries.billable]: { checked: row.billable ? "true" : "false" },
        [c.timeEntries.weekStatus]: { label: row.weekStatus },
      });
      teSync++;
    } catch {
      teErr++;
    }
  }

  for (const row of expenses) {
    try {
      await createItem(expBoard, row.itemName, {
        [c.expenses.trainer]: row.trainer,
        [c.expenses.project]: row.project,
        [c.expenses.date]: { date: row.date },
        [c.expenses.category]: { label: row.category },
        [c.expenses.amount]: row.amount,
        [c.expenses.description]: { text: row.description },
        [c.expenses.status]: { label: row.status },
        [c.expenses.rejectionReason]: row.rejectionReason,
        [c.expenses.submittedAt]: row.submittedAt
          ? { date: row.submittedAt.split("T")[0] }
          : undefined,
      });
      expSync++;
    } catch {
      expErr++;
    }
  }

  for (const row of timesheets) {
    try {
      await createItem(tsBoard, row.itemName, {
        [c.timesheets.trainer]: row.trainer,
        [c.timesheets.weekStart]: { date: row.weekStart },
        [c.timesheets.totalHours]: row.totalHours,
        [c.timesheets.breakHours]: row.breakHours,
        [c.timesheets.status]: { label: row.status },
        [c.timesheets.submittedAt]: row.submittedAt
          ? { date: row.submittedAt.split("T")[0] }
          : undefined,
      });
      tsSync++;
    } catch {
      tsErr++;
    }
  }

  const allOk = teErr === 0 && expErr === 0 && tsErr === 0;
  return {
    success: allOk,
    configured: true,
    timeEntries: { synced: teSync, errors: teErr },
    expenses: { synced: expSync, errors: expErr },
    timesheets: { synced: tsSync, errors: tsErr },
    timestamp: new Date().toISOString(),
    message: allOk
      ? `Sync complete. ${teSync} time entries, ${expSync} expenses, ${tsSync} timesheets pushed to Monday.`
      : `Sync finished with errors. Time entries: ${teSync}/${timeEntries.length}, Expenses: ${expSync}/${expenses.length}, Timesheets: ${tsSync}/${timesheets.length}.`,
  };
}
