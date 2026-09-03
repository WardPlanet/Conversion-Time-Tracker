import Link from "next/link";
import { notFound } from "next/navigation";
import { store } from "@/lib/data";
import { TrainerProfileNav } from "@/components/admin/TrainerProfileNav";

export default async function TrainerProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const trainer = await store.getUserById(params.id);
  if (!trainer || trainer.role !== "trainer") notFound();

  return (
    <div>
      <Link
        href="/admin/trainers"
        className="text-sm text-brand-darkBlue/60 hover:text-brand-darkBlue"
      >
        ← Trainers
      </Link>

      <div className="mt-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-blue">{trainer.name}</h1>
        <span
          className={
            trainer.active
              ? "text-xs font-medium text-brand-green"
              : "text-xs font-medium text-brand-darkBlue/50"
          }
        >
          {trainer.active ? "Active" : "Deactivated"}
        </span>
      </div>

      <div className="mt-4">
        <TrainerProfileNav trainerId={params.id} />
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
