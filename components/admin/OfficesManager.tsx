"use client";

import { useEffect, useState } from "react";
import type { Office } from "@/lib/types";
import { AddOfficeForm } from "@/components/admin/AddOfficeForm";

/** A project's office list (add + activate/deactivate) — lives on that project's own profile page. */
export function OfficesManager({ projectId }: { projectId: string }) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const response = await fetch(
      `/api/admin/offices?projectId=${projectId}`
    );
    const data = await response.json();
    setOffices(data.offices ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function toggleActive(office: Office) {
    const response = await fetch(`/api/admin/offices/${office.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !office.active }),
    });
    if (response.ok) await load();
  }

  async function markComplete(office: Office) {
    const response = await fetch(`/api/admin/offices/${office.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    if (response.ok) await load();
  }

  async function reopen(office: Office) {
    const response = await fetch(`/api/admin/offices/${office.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false, active: true }),
    });
    if (response.ok) await load();
  }

  const activeOffices = offices.filter((o) => !o.completed);
  const completedOffices = offices.filter((o) => o.completed);

  return (
    <div>
      <h3 className="text-sm font-medium text-brand-darkBlue/80">OIDs</h3>
      <div className="mt-2">
        <AddOfficeForm projectId={projectId} onCreated={load} />
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-brand-darkBlue/60">Loading…</p>
      ) : offices.length === 0 ? (
        <p className="mt-3 text-sm text-brand-darkBlue/60">
          No OIDs configured for this project yet.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {activeOffices.map((office) => (
              <li
                key={office.id}
                className="flex items-center justify-between rounded-md border border-brand-darkBlue/10 px-3 py-2"
              >
                <span className="text-sm font-medium">{office.name}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      office.active
                        ? "text-xs font-medium text-brand-green"
                        : "text-xs font-medium text-brand-darkBlue/50"
                    }
                  >
                    {office.active ? "Active" : "Deactivated"}
                  </span>
                  <button
                    onClick={() => toggleActive(office)}
                    className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-sm hover:bg-brand-blueWater"
                  >
                    {office.active ? "Deactivate" : "Reactivate"}
                  </button>
                  <button
                    onClick={() => markComplete(office)}
                    className="rounded-md border border-brand-green/40 px-3 py-1 text-sm text-brand-green hover:bg-brand-green/10"
                  >
                    Mark Complete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {completedOffices.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-darkBlue/40">
                Completed
              </p>
              <ul className="mt-2 space-y-2">
                {completedOffices.map((office) => (
                  <li
                    key={office.id}
                    className="flex items-center justify-between rounded-md border border-brand-darkBlue/10 bg-brand-blueWater/30 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-brand-darkBlue/50 line-through">
                      {office.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-brand-green">
                        Completed
                      </span>
                      <button
                        onClick={() => reopen(office)}
                        className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-sm hover:bg-brand-blueWater"
                      >
                        Reopen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
