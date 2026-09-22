"use client";

import { useEffect, useState } from "react";
import type { EnrichedWorkOrder } from "@/lib/data/store";
import { formatDateRange } from "@/lib/format";
import { CheckCircle, XCircle, Clock } from "lucide-react";

function statusBadge(status: string) {
  if (status === "accepted")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle className="h-3 w-3" /> Approved
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <XCircle className="h-3 w-3" /> Denied
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

export default function PartnerWorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<EnrichedWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [denyTarget, setDenyTarget] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");

  async function load() {
    const res = await fetch("/api/partner/work-orders");
    if (!res.ok) { setError("Failed to load work orders."); setLoading(false); return; }
    const data = await res.json();
    setWorkOrders(data.workOrders);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function respond(id: string, action: "approve" | "deny", reason?: string) {
    setActionPending(id);
    const res = await fetch(`/api/partner/work-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    setActionPending(null);
    if (!res.ok) {
      setError("Failed to update work order.");
      return;
    }
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== id) return wo;
        return { ...wo, status: action === "approve" ? "accepted" : "rejected" };
      })
    );
  }

  const pending = workOrders.filter((w) => w.status === "pending");
  const resolved = workOrders.filter((w) => w.status !== "pending");

  if (loading) return <p className="text-sm text-brand-darkBlue/50">Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Work Orders</h1>
      <p className="mt-1 text-sm text-brand-darkBlue/50">
        Review and approve or deny training work orders for your trainers.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Deny reason modal */}
      {denyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-brand-darkBlue">Deny work order</h2>
            <p className="mt-1 text-sm text-brand-darkBlue/60">
              Optionally provide a reason for the denial.
            </p>
            <textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              rows={3}
              placeholder="Reason (optional)"
              className="mt-3 w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setDenyTarget(null); setDenyReason(""); }}
                className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater"
              >
                Cancel
              </button>
              <button
                disabled={!!actionPending}
                onClick={async () => {
                  const id = denyTarget;
                  setDenyTarget(null);
                  await respond(id, "deny", denyReason || undefined);
                  setDenyReason("");
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending */}
      <section className="mt-6">
        <h2 className="text-base font-medium text-brand-darkBlue">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-brand-darkBlue/50">No pending work orders.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {pending.map((wo) => (
              <WorkOrderCard
                key={wo.id}
                wo={wo}
                actionPending={actionPending}
                onApprove={() => respond(wo.id, "approve")}
                onDeny={() => setDenyTarget(wo.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Resolved */}
      {resolved.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-medium text-brand-darkBlue">History</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {resolved.map((wo) => (
              <WorkOrderCard key={wo.id} wo={wo} actionPending={null} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function WorkOrderCard({
  wo,
  actionPending,
  onApprove,
  onDeny,
}: {
  wo: EnrichedWorkOrder;
  actionPending: string | null;
  onApprove?: () => void;
  onDeny?: () => void;
}) {
  const isPending = actionPending === wo.id;
  return (
    <li className="rounded-lg border border-brand-darkBlue/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-brand-darkBlue">{wo.title}</p>
          <p className="mt-0.5 text-sm text-brand-darkBlue/60">
            {wo.trainer?.name ?? "Unknown trainer"} ·{" "}
            {wo.project?.name ?? "Unknown project"}
          </p>
          <p className="mt-0.5 text-sm text-brand-darkBlue/50">
            {formatDateRange(wo.startTime, wo.endTime)}
          </p>
          {wo.office && (
            <p className="mt-0.5 text-xs text-brand-darkBlue/40">{wo.office.name}</p>
          )}
        </div>
        {statusBadge(wo.status)}
      </div>
      {wo.status === "pending" && onApprove && onDeny && (
        <div className="mt-3 flex gap-2">
          <button
            disabled={isPending}
            onClick={onApprove}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={isPending}
            onClick={onDeny}
            className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm text-brand-darkBlue hover:bg-brand-blueWater disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      )}
      {wo.rejectionReason && (
        <p className="mt-2 text-xs text-red-600">Reason: {wo.rejectionReason}</p>
      )}
    </li>
  );
}
