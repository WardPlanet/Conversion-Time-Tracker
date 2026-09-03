/**
 * Monday.com integration service.
 *
 * Required env vars (add to .env.local):
 *   MONDAY_API_KEY               - Your Monday.com API v2 token
 *   MONDAY_TIME_TRACKER_BOARD_ID - The board ID for all time tracker data
 *
 * The integration auto-creates three Groups on the board on first sync:
 *   "Time Entries", "Expenses", "Timesheets"
 *
 * Each record is created as a Monday item with a descriptive name. All
 * detail is written as a text update on the item so data is immediately
 * visible without needing column configuration. Column mapping can be
 * added later once the board structure is finalised.
 */

const MONDAY_API_URL = "https://api.monday.com/v2";

export function isMondayConfigured(): boolean {
  return Boolean(
    process.env.MONDAY_API_KEY && process.env.MONDAY_TIME_TRACKER_BOARD_ID
  );
}

export function mondayConfigStatus(): { configured: boolean; missing: string[] } {
  const required: [string, string | undefined][] = [
    ["MONDAY_API_KEY", process.env.MONDAY_API_KEY],
    ["MONDAY_TIME_TRACKER_BOARD_ID", process.env.MONDAY_TIME_TRACKER_BOARD_ID],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  return { configured: missing.length === 0, missing };
}

async function mondayRequest(
  gql: string
): Promise<{ data?: unknown; errors?: { message: string }[] }> {
  const key = process.env.MONDAY_API_KEY;
  if (!key) throw new Error("MONDAY_API_KEY is not set.");
  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ query: gql }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  }
  return json;
}

// ── Group management ───────────────────────────────────────────────────────

const GROUP_TITLES = {
  timeEntries: "Time Entries",
  expenses: "Expenses",
  timesheets: "Timesheets",
} as const;

/** Returns the group ID for a given title, creating the group if it doesn't exist. */
async function getOrCreateGroup(boardId: string, title: string): Promise<string> {
  const listResult = await mondayRequest(
    `query { boards(ids: [${boardId}]) { groups { id title } } }`
  );
  const data = listResult.data as { boards?: { groups: { id: string; title: string }[] }[] };
  const existing = data?.boards?.[0]?.groups?.find((g) => g.title === title);
  if (existing) return existing.id;

  const createResult = await mondayRequest(
    `mutation { create_group(board_id: ${boardId}, group_name: ${JSON.stringify(title)}) { id } }`
  );
  const created = createResult.data as { create_group?: { id: string } };
  const id = created?.create_group?.id;
  if (!id) throw new Error(`Failed to create group "${title}".`);
  return id;
}

// ── Item creation ──────────────────────────────────────────────────────────

async function createItemWithUpdate(
  boardId: string,
  groupId: string,
  itemName: string,
  updateBody: string
): Promise<void> {
  const itemResult = await mondayRequest(
    `mutation {
      create_item(
        board_id: ${boardId},
        group_id: ${JSON.stringify(groupId)},
        item_name: ${JSON.stringify(itemName)}
      ) { id }
    }`
  );
  const itemData = itemResult.data as { create_item?: { id: string } };
  const itemId = itemData?.create_item?.id;
  if (!itemId) throw new Error("Item created but no ID returned.");

  await mondayRequest(
    `mutation {
      create_update(item_id: ${itemId}, body: ${JSON.stringify(updateBody)}) { id }
    }`
  );
}

// ── Row types ──────────────────────────────────────────────────────────────

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

// ── Main sync ──────────────────────────────────────────────────────────────

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
        "Monday.com is not configured. Add MONDAY_API_KEY and MONDAY_TIME_TRACKER_BOARD_ID to your .env.local file.",
    };
  }

  const boardId = process.env.MONDAY_TIME_TRACKER_BOARD_ID!;

  // Ensure all three groups exist before syncing
  const [teGroupId, expGroupId, tsGroupId] = await Promise.all([
    getOrCreateGroup(boardId, GROUP_TITLES.timeEntries),
    getOrCreateGroup(boardId, GROUP_TITLES.expenses),
    getOrCreateGroup(boardId, GROUP_TITLES.timesheets),
  ]);

  let teSync = 0, teErr = 0;
  let expSync = 0, expErr = 0;
  let tsSync = 0, tsErr = 0;

  for (const row of timeEntries) {
    try {
      await createItemWithUpdate(
        boardId,
        teGroupId,
        row.itemName,
        [
          `Trainer: ${row.trainer}`,
          `Project: ${row.project}`,
          `Task: ${row.task}`,
          `Date: ${row.date}`,
          `Hours: ${row.hours}`,
          `Location: ${row.location || "—"}`,
          `Office: ${row.office}`,
          `Billable: ${row.billable ? "Yes" : "No"}`,
          `Week Status: ${row.weekStatus}`,
          `Note: ${row.note}`,
        ].join("\n")
      );
      teSync++;
    } catch {
      teErr++;
    }
  }

  for (const row of expenses) {
    try {
      await createItemWithUpdate(
        boardId,
        expGroupId,
        row.itemName,
        [
          `Trainer: ${row.trainer}`,
          `Project: ${row.project || "—"}`,
          `Date: ${row.date}`,
          `Category: ${row.category}`,
          `Amount: $${row.amount.toFixed(2)}`,
          `Status: ${row.status}`,
          row.rejectionReason ? `Rejection Reason: ${row.rejectionReason}` : "",
          `Description: ${row.description}`,
        ]
          .filter(Boolean)
          .join("\n")
      );
      expSync++;
    } catch {
      expErr++;
    }
  }

  for (const row of timesheets) {
    try {
      await createItemWithUpdate(
        boardId,
        tsGroupId,
        row.itemName,
        [
          `Trainer: ${row.trainer}`,
          `Week Start: ${row.weekStart}`,
          `Total Hours: ${row.totalHours}`,
          `Status: ${row.status}`,
          row.submittedAt ? `Submitted: ${row.submittedAt.split("T")[0]}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
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
      ? `Sync complete — ${teSync} time entries, ${expSync} expenses, ${tsSync} timesheets pushed to Monday.`
      : `Sync finished with errors. Time entries: ${teSync}/${timeEntries.length}, Expenses: ${expSync}/${expenses.length}, Timesheets: ${tsSync}/${timesheets.length}.`,
  };
}
