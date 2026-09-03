"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { AddProjectForm } from "@/components/admin/AddProjectForm";
import { AddTrainerForm } from "@/components/admin/AddTrainerForm";
import { AddOfficeFlow } from "@/components/admin/AddOfficeFlow";

type ModalKind = "project" | "trainer" | "office" | null;

export function QuickActions() {
  const router = useRouter();
  const [openModal, setOpenModal] = useState<ModalKind>(null);

  function handleCreated() {
    setOpenModal(null);
    router.refresh();
  }

  return (
    <section className="mt-6">
      <h2 className="text-lg font-medium">Quick actions</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          onClick={() => setOpenModal("project")}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
        >
          Add Project
        </button>
        <button
          onClick={() => setOpenModal("trainer")}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
        >
          Add Trainer
        </button>
        <button
          onClick={() => setOpenModal("office")}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
        >
          Add Office
        </button>
      </div>

      <Modal
        open={openModal === "project"}
        onClose={() => setOpenModal(null)}
        title="Add project"
      >
        <AddProjectForm onCreated={handleCreated} />
      </Modal>

      <Modal
        open={openModal === "trainer"}
        onClose={() => setOpenModal(null)}
        title="Add trainer"
      >
        <AddTrainerForm onCreated={handleCreated} />
      </Modal>

      <Modal
        open={openModal === "office"}
        onClose={() => setOpenModal(null)}
        title="Add office"
      >
        <AddOfficeFlow onCreated={handleCreated} />
      </Modal>
    </section>
  );
}
