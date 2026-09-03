"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, XCircle, RefreshCw, AlertCircle } from "lucide-react";

interface SyncStatus {
  configured: boolean;
  configStatus: { configured: boolean; missing: string[] };
  lastSync: {
    timestamp: string;
    success: boolean;
    message: string;
    timeEntries: { synced: number; errors: number };
    expenses: { synced: number; errors: number };
    timesheets: { synced: number; errors: number };
  } | null;
}

export function MondaySyncSection() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/admin/monday-sync");
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleSyncNow() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/admin/monday-sync", { method: "POST" });
      const data = await res.json();
      if (!data.success && data.configured) {
        setSyncError(data.message);
      }
      await loadStatus();
    } catch {
      setSyncError("Network error — could not reach the sync endpoint.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="rounded-md border border-brand-darkBlue/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Monday.com Integration</h2>
          <p className="mt-1 text-sm text-brand-darkBlue/60">
            Sync all time entries, expenses, and timesheets to your Monday.com boards.
            Configure the env vars below, then use Sync Now or set up a scheduled cron.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing || !status?.configured}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
          title={!status?.configured ? "Configure Monday.com env vars first" : undefined}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Now"}
        </button>
      </div>

      {/* Config status */}
      <div className="mt-5">
        <h3 className="text-sm font-medium text-brand-darkBlue/80">Configuration</h3>
        {status ? (
          status.configured ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              All required environment variables are set.
            </div>
          ) : (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-sm text-brand-orange">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Not configured yet — add these to your <code className="rounded bg-brand-blueWater px-1">.env.local</code>:
              </div>
              <ul className="ml-6 mt-1 list-disc space-y-0.5 text-sm text-brand-darkBlue/70">
                {status.configStatus.missing.map((key) => (
                  <li key={key}>
                    <code className="rounded bg-brand-blueWater px-1">{key}</code>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <p className="mt-2 text-sm text-brand-darkBlue/40">Loading…</p>
        )}
      </div>

      {/* Last sync */}
      <div className="mt-5">
        <h3 className="text-sm font-medium text-brand-darkBlue/80">Last Sync</h3>
        {status?.lastSync ? (
          <div className="mt-2 rounded-md border border-brand-darkBlue/10 p-4 text-sm">
            <div className="flex items-center gap-2">
              {status.lastSync.success ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-500" />
              )}
              <span className="text-brand-darkBlue/70">
                {new Date(status.lastSync.timestamp).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-brand-darkBlue/60">{status.lastSync.message}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-brand-darkBlue/60">
              <span>Time entries: {status.lastSync.timeEntries.synced} synced, {status.lastSync.timeEntries.errors} errors</span>
              <span>Expenses: {status.lastSync.expenses.synced} synced, {status.lastSync.expenses.errors} errors</span>
              <span>Timesheets: {status.lastSync.timesheets.synced} synced, {status.lastSync.timesheets.errors} errors</span>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-brand-darkBlue/60">No sync has run yet this session.</p>
        )}
      </div>

      {syncError && (
        <p className="mt-3 text-sm text-red-600">{syncError}</p>
      )}

      {/* Scheduling note */}
      <div className="mt-5 rounded-md border border-brand-darkBlue/10 bg-brand-blueWater/50 p-4 text-sm text-brand-darkBlue/70">
        <p className="font-medium text-brand-darkBlue/80">Setting up automatic syncs</p>
        <p className="mt-1">
          To sync on a schedule, add a cron job that POSTs to{" "}
          <code className="rounded bg-white px-1">/api/admin/monday-sync</code> with an{" "}
          <code className="rounded bg-white px-1">Authorization</code> header.
          On Vercel, add this to your <code className="rounded bg-white px-1">vercel.json</code>:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-white p-3 text-xs leading-relaxed">
{`{
  "crons": [{
    "path": "/api/admin/monday-sync",
    "schedule": "0 2 * * *"
  }]
}`}
        </pre>
        <p className="mt-1 text-xs text-brand-darkBlue/50">
          Runs nightly at 2 AM UTC. Adjust to your preferred time using{" "}
          <a href="https://crontab.guru" target="_blank" rel="noreferrer" className="underline">
            crontab.guru
          </a>.
        </p>
      </div>
    </section>
  );
}
