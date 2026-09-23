"use client";

import { useEffect, useState } from "react";
import type { Booking, WeeklySubmission, TimesheetSubmission, Expense } from "@/lib/types";
import type { PublicUser } from "@/lib/types";
import { formatDateRange } from "@/lib/format";
import { CheckCircle, XCircle, Clock } from "lucide-react";

// ─── Enriched types returned by the partner API ──────────────────────────────

type EnrichedWorkOrder = Booking & { trainer: PublicUser | null; project: { name: string } | null; office: { name: string } | null };
type EnrichedWeeklySubmission = WeeklySubmission & { trainer: PublicUser | null };
type EnrichedTimesheetSubmission = TimesheetSubmission & { trainer: PublicUser | null };
type EnrichedExpense = Expense & { trainer: PublicUser | null };

// ─── Status badge ─────────────────────────────────────────────────────────────

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

// ─── Deny/Reject reason modal ─────────────────────────────────────────────────

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

// ─── Action row ───────────────────────────────────────────────────────────────

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

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = "work-orders" | "timesheets" | "time-clock" | "expenses";

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

  // ── Work order actions ─────────────────────────────────────────────────────

  async function respondWorkOrder(id: string, action: "approve" | "deny", reason?: string) {
    setActionPending(id);
    const res = await fetch(`/api/partner/work-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    setActionPending(null);
    if (!res.ok) { setError("Failed to update work order."); return; }
    setWorkOrders((prev) => prev.map((wo) => wo.id === id ? { ...wo, status: action === "approve" ? "accepted" : "rejected" } : wo));
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

  // ── Deny/reject modal handler ──────────────────────────────────────────────

  const [denyWorkOrderId, setDenyWorkOrderId] = useState<string | null>(null);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "work-orders", label: "Work Orders", count: workOrders.filter((w) => w.status === "pending").length },
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

      {/* Work Orders tab */}
      {activeTab === "work-orders" && (
        <>
          {denyWorkOrderId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-brand-darkBlue">Deny work order</h2>
                <p className="mt-1 text-sm text-brand-darkBlue/60">Optionally provide a reason for the denial.</p>
                <DenyWorkOrderModal
                  onConfirm={async (reason) => {
                    const id = denyWorkOrderId;
                    setDenyWorkOrderId(null);
                    await respondWorkOrder(id, "deny", reason || undefined);
                  }}
                  onClose={() => setDenyWorkOrderId(null)}
                  submitting={!!actionPending}
                />
              </div>
            </div>
          )}
          <WorkOrderSection
            workOrders={workOrders}
            actionPending={actionPending}
            onApprove={(id) => respondWorkOrder(id, "approve")}
            onDeny={(id) => setDenyWorkOrderId(id)}
          />
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

// ─── Work Orders section ──────────────────────────────────────────────────────

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

function WorkOrderSection({ workOrders, actionPending, onApprove, onDeny }: {
  workOrders: EnrichedWorkOrder[];
  actionPending: string | null;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  const pending = workOrders.filter((w) => w.status === "pending");
  const resolved = workOrders.filter((w) => w.status !== "pending");
  return (
    <div className="mt-6 space-y-6">
      <div>
        <h2 className="text-base font-medium text-brand-darkBlue">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-brand-darkBlue/50">No pending work orders.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {pending.map((wo) => (
              <li key={wo.id} className="rounded-lg border border-brand-darkBlue/10 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-brand-darkBlue">{wo.title}</p>
                    <p className="mt-0.5 text-sm text-brand-darkBlue/60">{wo.trainer?.name ?? "Unknown"} · {wo.project?.name ?? "Unknown project"}</p>
                    <p className="mt-0.5 text-sm text-brand-darkBlue/50">{formatDateRange(wo.startTime, wo.endTime)}</p>
                    {wo.office && <p className="mt-0.5 text-xs text-brand-darkBlue/40">{wo.office.name}</p>}
                  </div>
                  <PendingBadge />
                </div>
                <ActionButtons id={wo.id} actionPending={actionPending} onApprove={() => onApprove(wo.id)} onReject={() => onDeny(wo.id)} rejectLabel="Deny" />
              </li>
            ))}
          </ul>
        )}
      </div>
      {resolved.length > 0 && (
        <div>
          <h2 className="text-base font-medium text-brand-darkBlue">History</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {resolved.map((wo) => (
              <li key={wo.id} className="rounded-lg border border-brand-darkBlue/10 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-brand-darkBlue">{wo.title}</p>
                    <p className="mt-0.5 text-sm text-brand-darkBlue/60">{wo.trainer?.name ?? "Unknown"} · {wo.project?.name ?? "Unknown project"}</p>
                    <p className="mt-0.5 text-sm text-brand-darkBlue/50">{formatDateRange(wo.startTime, wo.endTime)}</p>
                  </div>
                  {workOrderStatusBadge(wo.status)}
                </div>
                {wo.rejectionReason && <p className="mt-2 text-xs text-red-600">Reason: {wo.rejectionReason}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
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
