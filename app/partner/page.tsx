"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, format, subMonths } from "date-fns";
import type { Booking, WeeklySubmission, TimesheetSubmission, Expense } from "@/lib/types";
import type { PublicUser } from "@/lib/types";
import { formatDateRange } from "@/lib/format";
import { toLocalDateString } from "@/lib/format";
import { getMonthGridWeeks, groupByLocalDate } from "@/lib/domain/calendar-grid";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { CalendarNav } from "@/components/calendar/CalendarNav";
import { CheckCircle, XCircle, Clock } from "lucide-react";

// ─── Enriched types returned by the partner API ──────────────────────────────

type EnrichedWorkOrder = Booking & { trainer: PublicUser | null; project: { name: string } | null; office: { name: string } | null };
type EnrichedWeeklySubmission = WeeklySubmission & { trainer: PublicUser | null };
type EnrichedTimesheetSubmission = TimesheetSubmission & { trainer: PublicUser | null };
type EnrichedExpense = Expense & { trainer: PublicUser | null };

// ─── Work order grouping ──────────────────────────────────────────────────────

type WorkOrderGroup = {
  key: string;
  groupId: string | null;
  bookings: EnrichedWorkOrder[];
  status: string;
  trainer: PublicUser | null;
  project: { name: string } | null;
  office: { name: string } | null;
};

function groupWorkOrders(workOrders: EnrichedWorkOrder[]): WorkOrderGroup[] {
  const groupMap = new Map<string, WorkOrderGroup>();
  for (const wo of workOrders) {
    const key = wo.groupId ?? wo.id;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        groupId: wo.groupId ?? null,
        bookings: [],
        status: wo.status,
        trainer: wo.trainer,
        project: wo.project,
        office: wo.office,
      });
    }
    groupMap.get(key)!.bookings.push(wo);
  }
  for (const g of groupMap.values()) {
    g.bookings.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return Array.from(groupMap.values());
}

// ─── Status badges ────────────────────────────────────────────────────────────

function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}
function ApprovedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      <CheckCircle className="h-3 w-3" /> Approved
    </span>
  );
}
function DeniedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      <XCircle className="h-3 w-3" /> Denied
    </span>
  );
}

function workOrderStatusBadge(status: string) {
  if (status === "accepted") return <ApprovedBadge />;
  if (status === "rejected") return <DeniedBadge />;
  return <PendingBadge />;
}

// ─── Deny modal ───────────────────────────────────────────────────────────────

function DenyWorkOrderModal({ onConfirm, onClose, submitting }: { onConfirm: (r: string) => void; onClose: () => void; submitting: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason (optional)" className="mt-3 w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue" />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater">Cancel</button>
        <button disabled={submitting} onClick={() => onConfirm(reason)} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Deny</button>
      </div>
    </>
  );
}

// ─── Reject reason modal ──────────────────────────────────────────────────────

function ReasonModal({
  title,
  onConfirm,
  onClose,
  submitting,
}: {
  title: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-brand-darkBlue">{title}</h2>
        <p className="mt-1 text-sm text-brand-darkBlue/60">Provide a reason for the rejection.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Reason (required)"
          className="mt-3 w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater">
            Cancel
          </button>
          <button
            disabled={submitting || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = "work-orders" | "timesheets" | "time-clock" | "expenses";

// ─── Trainer color map ────────────────────────────────────────────────────────

const TRAINER_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316",
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PartnerPortalPage() {
  const [activeTab, setActiveTab] = useState<Tab>("work-orders");
  const [workOrders, setWorkOrders] = useState<EnrichedWorkOrder[]>([]);
  const [weeklySubmissions, setWeeklySubmissions] = useState<EnrichedWeeklySubmission[]>([]);
  const [timesheetSubmissions, setTimesheetSubmissions] = useState<EnrichedTimesheetSubmission[]>([]);
  const [expenses, setExpenses] = useState<EnrichedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; type: "weekly" | "timesheet" | "expense" } | null>(null);
  const [denyWorkOrderGroupKey, setDenyWorkOrderGroupKey] = useState<string | null>(null);

  // Calendar state
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const today = useMemo(() => new Date(), []);

  async function loadAll() {
    setLoading(true);
    const [woRes, subRes] = await Promise.all([
      fetch("/api/partner/work-orders"),
      fetch("/api/partner/submissions"),
    ]);
    if (!woRes.ok || !subRes.ok) { setError("Failed to load data."); setLoading(false); return; }
    const [woData, subData] = await Promise.all([woRes.json(), subRes.json()]);
    setWorkOrders(woData.workOrders);
    setWeeklySubmissions(subData.weeklySubmissions);
    setTimesheetSubmissions(subData.timesheetSubmissions);
    setExpenses(subData.expenses);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // ── Work order group actions ───────────────────────────────────────────────

  async function respondWorkOrderGroup(group: WorkOrderGroup, action: "approve" | "deny", reason?: string) {
    const representativeId = group.bookings[0].id;
    setActionPending(group.key);
    const res = await fetch(`/api/partner/work-orders/${representativeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    setActionPending(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to update work order.");
      return;
    }
    const newStatus = action === "approve" ? "accepted" : "rejected";
    setWorkOrders((prev) =>
      prev.map((wo) =>
        group.bookings.some((b) => b.id === wo.id)
          ? { ...wo, status: newStatus, rejectionReason: action === "deny" ? reason : wo.rejectionReason }
          : wo
      )
    );
  }

  // ── Submission / expense actions ───────────────────────────────────────────

  async function reviewItem(
    id: string,
    type: "weekly" | "timesheet" | "expense",
    action: "approve" | "reject",
    reason?: string
  ) {
    setActionPending(id);
    const pathMap = { weekly: "weekly-submissions", timesheet: "timesheet-submissions", expense: "expenses" };
    const res = await fetch(`/api/partner/${pathMap[type]}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    setActionPending(null);
    if (!res.ok) { setError("Failed to update item."); return; }
    if (type === "weekly") setWeeklySubmissions((prev) => prev.filter((s) => s.id !== id));
    if (type === "timesheet") setTimesheetSubmissions((prev) => prev.filter((s) => s.id !== id));
    if (type === "expense") setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  // ── Calendar helpers ───────────────────────────────────────────────────────

  const calendarWeeks = useMemo(() => getMonthGridWeeks(calendarCursor), [calendarCursor]);

  const trainerColorMap = useMemo(() => {
    const trainerIds = [...new Set(workOrders.map((wo) => wo.trainerId))];
    return new Map(trainerIds.map((id, i) => [id, TRAINER_COLORS[i % TRAINER_COLORS.length]]));
  }, [workOrders]);

  const bookingsByDay = useMemo(
    () => groupByLocalDate(workOrders, (b) => new Date(b.startTime)),
    [workOrders]
  );

  // ── Grouped work orders ────────────────────────────────────────────────────

  const workOrderGroups = useMemo(() => groupWorkOrders(workOrders), [workOrders]);
  const pendingGroups = workOrderGroups.filter((g) => g.status === "pending");
  const resolvedGroups = workOrderGroups.filter((g) => g.status !== "pending");

  // ── Deny modal for a group ─────────────────────────────────────────────────

  const denyGroup = denyWorkOrderGroupKey
    ? workOrderGroups.find((g) => g.key === denyWorkOrderGroupKey) ?? null
    : null;

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "work-orders", label: "Work Orders", count: pendingGroups.length },
    { id: "timesheets", label: "Task Tracker", count: weeklySubmissions.length },
    { id: "time-clock", label: "Time Clock", count: timesheetSubmissions.length },
    { id: "expenses", label: "Expenses", count: expenses.length },
  ];

  if (loading) return <p className="text-sm text-brand-darkBlue/50">Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Partner Portal</h1>
      <p className="mt-1 text-sm text-brand-darkBlue/50">
        Review and approve work orders, timesheets, and expenses for your trainers.
      </p>

      {error && <p className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-brand-darkBlue/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-brand-blue text-brand-blue"
                : "text-brand-darkBlue/50 hover:text-brand-darkBlue"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-xs font-semibold text-brand-blue">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Work Orders tab — two-column layout */}
      {activeTab === "work-orders" && (
        <>
          {denyGroup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-brand-darkBlue">Deny work order</h2>
                <p className="mt-1 text-sm text-brand-darkBlue/60">Optionally provide a reason for the denial.</p>
                <DenyWorkOrderModal
                  onConfirm={async (reason) => {
                    const g = denyGroup;
                    setDenyWorkOrderGroupKey(null);
                    await respondWorkOrderGroup(g, "deny", reason || undefined);
                  }}
                  onClose={() => setDenyWorkOrderGroupKey(null)}
                  submitting={!!actionPending}
                />
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
            {/* Left: approvals panel */}
            <div className="space-y-6">
              {/* Pending */}
              <div>
                <h2 className="text-base font-medium text-brand-darkBlue">
                  Pending ({pendingGroups.length})
                </h2>
                {pendingGroups.length === 0 ? (
                  <p className="mt-2 text-sm text-brand-darkBlue/50">No pending work orders.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {pendingGroups.map((group) => {
                      const first = group.bookings[0];
                      const last = group.bookings[group.bookings.length - 1];
                      const busy = actionPending === group.key;
                      return (
                        <li key={group.key} className="rounded-lg border border-brand-darkBlue/10 bg-white p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-brand-darkBlue">{first.title}</p>
                              <p className="mt-0.5 text-sm text-brand-darkBlue/60">
                                {group.trainer?.name ?? "Unknown"} · {group.project?.name ?? "Unknown project"}
                              </p>
                              <p className="mt-0.5 text-sm text-brand-darkBlue/50">
                                {formatDateRange(first.startTime, last.endTime)}
                                {group.bookings.length > 1 && (
                                  <span className="ml-1 text-xs text-brand-darkBlue/40">
                                    ({group.bookings.length} days)
                                  </span>
                                )}
                              </p>
                              {group.office && (
                                <p className="mt-0.5 text-xs text-brand-darkBlue/40">{group.office.name}</p>
                              )}
                            </div>
                            <PendingBadge />
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              disabled={busy}
                              onClick={() => respondWorkOrderGroup(group, "approve")}
                              className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => setDenyWorkOrderGroupKey(group.key)}
                              className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater disabled:opacity-50"
                            >
                              Deny
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* History */}
              {resolvedGroups.length > 0 && (
                <div>
                  <h2 className="text-base font-medium text-brand-darkBlue">History</h2>
                  <ul className="mt-3 flex flex-col gap-3">
                    {resolvedGroups.map((group) => {
                      const first = group.bookings[0];
                      const last = group.bookings[group.bookings.length - 1];
                      const denialReason = group.bookings.find((b) => b.rejectionReason)?.rejectionReason;
                      return (
                        <li key={group.key} className="rounded-lg border border-brand-darkBlue/10 bg-white p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-brand-darkBlue">{first.title}</p>
                              <p className="mt-0.5 text-sm text-brand-darkBlue/60">
                                {group.trainer?.name ?? "Unknown"} · {group.project?.name ?? "Unknown project"}
                              </p>
                              <p className="mt-0.5 text-sm text-brand-darkBlue/50">
                                {formatDateRange(first.startTime, last.endTime)}
                                {group.bookings.length > 1 && (
                                  <span className="ml-1 text-xs text-brand-darkBlue/40">
                                    ({group.bookings.length} days)
                                  </span>
                                )}
                              </p>
                            </div>
                            {workOrderStatusBadge(group.status)}
                          </div>
                          {denialReason && (
                            <p className="mt-2 text-xs text-red-600">Reason: {denialReason}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Right: calendar panel */}
            <div className="rounded-lg border border-brand-darkBlue/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm font-medium text-brand-darkBlue">
                  {format(calendarCursor, "MMMM yyyy")}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCalendarCursor((c) => subMonths(c, 1))}
                    className="rounded p-1 text-brand-darkBlue/50 hover:bg-brand-blueWater hover:text-brand-darkBlue"
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setCalendarCursor(new Date())}
                    className="rounded px-2 py-1 text-xs text-brand-darkBlue/50 hover:bg-brand-blueWater hover:text-brand-darkBlue"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setCalendarCursor((c) => addMonths(c, 1))}
                    className="rounded p-1 text-brand-darkBlue/50 hover:bg-brand-blueWater hover:text-brand-darkBlue"
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>
              </div>
              <CalendarGrid
                weeks={calendarWeeks}
                referenceMonth={calendarCursor}
                today={today}
                renderDayContent={(day) => {
                  const dateStr = toLocalDateString(day);
                  const dayBookings = bookingsByDay.get(dateStr) ?? [];
                  return (
                    <div className="flex flex-wrap gap-0.5 p-0.5">
                      {dayBookings.slice(0, 3).map((b) => (
                        <span
                          key={b.id}
                          title={`${b.trainer?.name ?? "Unknown"}: ${b.title}`}
                          className="block h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor: trainerColorMap.get(b.trainerId) ?? "#94A3B8",
                            opacity: b.status === "rejected" ? 0.35 : 1,
                          }}
                        />
                      ))}
                      {dayBookings.length > 3 && (
                        <span className="text-[9px] text-brand-darkBlue/40">+{dayBookings.length - 3}</span>
                      )}
                    </div>
                  );
                }}
              />
              {/* Trainer legend */}
              {trainerColorMap.size > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  {[...trainerColorMap.entries()].map(([trainerId, color]) => {
                    const name = workOrders.find((wo) => wo.trainerId === trainerId)?.trainer?.name ?? trainerId;
                    return (
                      <div key={trainerId} className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs text-brand-darkBlue/60">{name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Task Tracker tab */}
      {activeTab === "timesheets" && (
        <>
          {rejectTarget?.type === "weekly" && (
            <ReasonModal
              title="Reject task tracker week"
              onConfirm={(reason) => { const t = rejectTarget; setRejectTarget(null); reviewItem(t.id, "weekly", "reject", reason); }}
              onClose={() => setRejectTarget(null)}
              submitting={!!actionPending}
            />
          )}
          <SubmissionSection
            title="Task Tracker Submissions"
            emptyMessage="No task tracker weeks awaiting review."
            items={weeklySubmissions}
            renderDetail={(s) => (
              <p className="mt-0.5 text-sm text-brand-darkBlue/60">Week of {s.weekStartDate}</p>
            )}
            actionPending={actionPending}
            onApprove={(id) => reviewItem(id, "weekly", "approve")}
            onReject={(id) => setRejectTarget({ id, type: "weekly" })}
          />
        </>
      )}

      {/* Time Clock tab */}
      {activeTab === "time-clock" && (
        <>
          {rejectTarget?.type === "timesheet" && (
            <ReasonModal
              title="Reject timesheet"
              onConfirm={(reason) => { const t = rejectTarget; setRejectTarget(null); reviewItem(t.id, "timesheet", "reject", reason); }}
              onClose={() => setRejectTarget(null)}
              submitting={!!actionPending}
            />
          )}
          <SubmissionSection
            title="Time Clock Submissions"
            emptyMessage="No timesheets awaiting review."
            items={timesheetSubmissions}
            renderDetail={(s) => (
              <p className="mt-0.5 text-sm text-brand-darkBlue/60">Week of {s.weekStartDate}</p>
            )}
            actionPending={actionPending}
            onApprove={(id) => reviewItem(id, "timesheet", "approve")}
            onReject={(id) => setRejectTarget({ id, type: "timesheet" })}
          />
        </>
      )}

      {/* Expenses tab */}
      {activeTab === "expenses" && (
        <>
          {rejectTarget?.type === "expense" && (
            <ReasonModal
              title="Reject expense"
              onConfirm={(reason) => { const t = rejectTarget; setRejectTarget(null); reviewItem(t.id, "expense", "reject", reason); }}
              onClose={() => setRejectTarget(null)}
              submitting={!!actionPending}
            />
          )}
          <ExpenseSection
            expenses={expenses}
            actionPending={actionPending}
            onApprove={(id) => reviewItem(id, "expense", "approve")}
            onReject={(id) => setRejectTarget({ id, type: "expense" })}
          />
        </>
      )}
    </div>
  );
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionButtons({
  id,
  actionPending,
  onApprove,
  onReject,
  approveLabel = "Approve",
  rejectLabel = "Reject",
}: {
  id: string;
  actionPending: string | null;
  onApprove: () => void;
  onReject: () => void;
  approveLabel?: string;
  rejectLabel?: string;
}) {
  const busy = actionPending === id;
  return (
    <div className="mt-3 flex gap-2">
      <button disabled={busy} onClick={onApprove} className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50">
        {approveLabel}
      </button>
      <button disabled={busy} onClick={onReject} className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater disabled:opacity-50">
        {rejectLabel}
      </button>
    </div>
  );
}

// ─── Generic submission section ───────────────────────────────────────────────

function SubmissionSection<T extends { id: string; trainerId: string; trainer: PublicUser | null }>({
  title,
  emptyMessage,
  items,
  renderDetail,
  actionPending,
  onApprove,
  onReject,
}: {
  title: string;
  emptyMessage: string;
  items: T[];
  renderDetail: (item: T) => React.ReactNode;
  actionPending: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="mt-6">
      <h2 className="text-base font-medium text-brand-darkBlue">{title} ({items.length})</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-brand-darkBlue/50">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-brand-darkBlue/10 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-brand-darkBlue">{item.trainer?.name ?? "Unknown trainer"}</p>
                  {renderDetail(item)}
                </div>
                <PendingBadge />
              </div>
              <ActionButtons id={item.id} actionPending={actionPending} onApprove={() => onApprove(item.id)} onReject={() => onReject(item.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Expenses section ─────────────────────────────────────────────────────────

function ExpenseSection({ expenses, actionPending, onApprove, onReject }: {
  expenses: EnrichedExpense[];
  actionPending: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="mt-6">
      <h2 className="text-base font-medium text-brand-darkBlue">Pending Expenses ({expenses.length})</h2>
      {expenses.length === 0 ? (
        <p className="mt-2 text-sm text-brand-darkBlue/50">No expenses awaiting review.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {expenses.map((e) => (
            <li key={e.id} className="rounded-lg border border-brand-darkBlue/10 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-brand-darkBlue">
                    {e.category} — ${e.amount.toFixed(2)}
                  </p>
                  <p className="mt-0.5 text-sm text-brand-darkBlue/60">{e.trainer?.name ?? "Unknown"} · {e.date}</p>
                  <p className="mt-0.5 text-sm text-brand-darkBlue/50">{e.description}</p>
                </div>
                <PendingBadge />
              </div>
              <ActionButtons id={e.id} actionPending={actionPending} onApprove={() => onApprove(e.id)} onReject={() => onReject(e.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
