"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicUser } from "@/lib/types";
import { TrainerActiveToggle } from "@/components/admin/TrainerActiveToggle";
import { AddTrainerForm } from "@/components/admin/AddTrainerForm";
import { Modal } from "@/components/Modal";

export default function AdminTrainersPage() {
  const [trainers, setTrainers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTrainer, setShowAddTrainer] = useState(false);

  async function loadTrainers() {
    setLoading(true);
    const response = await fetch("/api/admin/trainers");
    const data = await response.json();
    setTrainers(data.trainers ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadTrainers();
  }, []);

  function handleCreated() {
    setShowAddTrainer(false);
    loadTrainers();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Trainers</h1>

      <div className="mt-6">
        <button
          onClick={() => setShowAddTrainer(true)}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
        >
          Add Trainer
        </button>
      </div>

      <Modal
        open={showAddTrainer}
        onClose={() => setShowAddTrainer(false)}
        title="Add trainer"
      >
        <AddTrainerForm onCreated={handleCreated} />
      </Modal>

      <section className="mt-8">
        <h2 className="text-lg font-medium">All trainers</h2>
        {loading ? (
          <p className="mt-3 text-sm text-brand-darkBlue/60">Loading…</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {trainers.map((trainer) => (
              <li
                key={trainer.id}
                className="flex items-center justify-between rounded-md border border-brand-darkBlue/10 bg-white shadow-sm px-4 py-3"
              >
                <div>
                  <Link
                    href={`/admin/trainers/${trainer.id}`}
                    className="font-medium text-brand-blue hover:underline"
                  >
                    {trainer.name}
                  </Link>
                  <p className="text-sm text-brand-darkBlue/60">
                    {trainer.username} · {trainer.email}
                  </p>
                </div>
                <TrainerActiveToggle
                  trainer={trainer}
                  onToggled={loadTrainers}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
