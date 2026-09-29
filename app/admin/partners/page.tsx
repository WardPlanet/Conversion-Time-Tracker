"use client";

import { useEffect, useState } from "react";
import type { Partner, PublicUser } from "@/lib/types";
import { Building2, UserPlus, Link2 } from "lucide-react";

interface PageData {
  partners: Partner[];
  trainers: PublicUser[];
}

export default function AdminPartnersPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New partner form
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");

  // New partner admin form
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPartnerId, setAdminPartnerId] = useState("");

  // Assign trainer form
  const [assignTrainerId, setAssignTrainerId] = useState("");
  const [assignPartnerId, setAssignPartnerId] = useState("");

  async function load() {
    const res = await fetch("/api/admin/partners");
    if (!res.ok) { setError("Failed to load data."); return; }
    setData(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function post(body: object) {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Request failed.");
      return false;
    }
    await load();
    return true;
  }

  async function createPartner() {
    if (!partnerName.trim() || !partnerEmail.trim()) { setError("Name and email are required."); return; }
    const ok = await post({ type: "partner", name: partnerName, contactEmail: partnerEmail });
    if (ok) { setPartnerName(""); setPartnerEmail(""); }
  }

  async function createPartnerAdmin() {
    if (!adminUsername || !adminPassword || !adminName || !adminEmail || !adminPartnerId) {
      setError("All fields are required."); return;
    }
    const ok = await post({ type: "partner_admin", username: adminUsername, password: adminPassword, name: adminName, email: adminEmail, partnerId: adminPartnerId });
    if (ok) { setAdminUsername(""); setAdminPassword(""); setAdminName(""); setAdminEmail(""); setAdminPartnerId(""); }
  }

  async function assignTrainer() {
    if (!assignTrainerId) { setError("Select a trainer."); return; }
    await post({ type: "assign_trainer", trainerId: assignTrainerId, partnerId: assignPartnerId || null });
  }

  const partners = data?.partners ?? [];
  const trainers = data?.trainers ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-brand-blue">Partners</h1>
        <p className="mt-1 text-sm text-brand-darkBlue/50">
          Manage partner organizations, their admins, and assigned trainers.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Partner list */}
      <section>
        <h2 className="flex items-center gap-2 text-base font-medium text-brand-darkBlue">
          <Building2 className="h-4 w-4" /> Partners ({partners.length})
        </h2>
        {partners.length === 0 ? (
          <p className="mt-2 text-sm text-brand-darkBlue/50">No partners yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {partners.map((p) => (
              <li key={p.id} className="rounded-lg border border-brand-darkBlue/10 bg-white px-4 py-3">
                <p className="font-medium text-brand-darkBlue">{p.name}</p>
                <p className="text-sm text-brand-darkBlue/50">{p.contactEmail}</p>
                <p className="mt-1 text-xs text-brand-darkBlue/30">ID: {p.id}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create partner */}
      <section>
        <h2 className="flex items-center gap-2 text-base font-medium text-brand-darkBlue">
          <Building2 className="h-4 w-4" /> Create partner
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            placeholder="Partner name"
            className="rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
          <input
            value={partnerEmail}
            onChange={(e) => setPartnerEmail(e.target.value)}
            placeholder="Contact email"
            type="email"
            className="rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
        </div>
        <button
          disabled={submitting}
          onClick={createPartner}
          className="mt-3 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
        >
          Create partner
        </button>
      </section>

      {/* Create partner admin */}
      <section>
        <h2 className="flex items-center gap-2 text-base font-medium text-brand-darkBlue">
          <UserPlus className="h-4 w-4" /> Create partner admin account
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Full name" className="rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue" />
          <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Email" type="email" className="rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue" />
          <input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="Username" className="rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue" />
          <input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Temporary password" type="password" className="rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue" />
          <select value={adminPartnerId} onChange={(e) => setAdminPartnerId(e.target.value)} className="rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue sm:col-span-2">
            <option value="">Select partner…</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button disabled={submitting} onClick={createPartnerAdmin} className="mt-3 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50">
          Create partner admin
        </button>
      </section>

      {/* Assign trainer */}
      <section>
        <h2 className="flex items-center gap-2 text-base font-medium text-brand-darkBlue">
          <Link2 className="h-4 w-4" /> Assign trainer to partner
        </h2>
        <p className="mt-1 text-sm text-brand-darkBlue/50">
          Leave partner blank to remove a trainer from their current partner.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select value={assignTrainerId} onChange={(e) => setAssignTrainerId(e.target.value)} className="rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue">
            <option value="">Select trainer…</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.partnerId ? ` (partner: ${partners.find(p => p.id === t.partnerId)?.name ?? t.partnerId})` : ""}
              </option>
            ))}
          </select>
          <select value={assignPartnerId} onChange={(e) => setAssignPartnerId(e.target.value)} className="rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm outline-none focus:border-brand-blue">
            <option value="">No partner (unassign)</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button disabled={submitting} onClick={assignTrainer} className="mt-3 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50">
          Save assignment
        </button>
      </section>
    </div>
  );
}
