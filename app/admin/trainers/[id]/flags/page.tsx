import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { store } from "@/lib/data";
import { enrichFlags } from "@/lib/domain/flags";
import { FlagsList } from "@/components/admin/FlagsList";

export default async function TrainerFlagsTab({
  params,
}: {
  params: { id: string };
}) {
  const trainer = await store.getUserById(params.id);
  if (!trainer || trainer.role !== "trainer") notFound();

  const session = await getSession();
  if (!session) notFound();
  const actor = { id: session.userId, role: session.role };

  const [flags, trainers, bookings, projects] = await Promise.all([
    store.listActiveFlagsForTrainer(params.id, actor),
    store.listTrainers(),
    store.listAllBookings(),
    store.listProjects(),
  ]);

  return (
    <div className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6">
      <h2 className="text-lg font-medium">Flags</h2>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        Active flags for {trainer.name}, computed automatically.
      </p>

      <div className="mt-4">
        <FlagsList
          initialFlags={enrichFlags(flags, trainers, bookings, projects)}
          trainerId={params.id}
          showTrainerLink={false}
        />
      </div>
    </div>
  );
}
