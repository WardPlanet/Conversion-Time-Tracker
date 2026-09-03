import { store } from "@/lib/data";
import { AdminProjectsList } from "@/components/admin/AdminProjectsList";

export default async function AdminProjectsPage() {
  const projects = await store.listProjects();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Projects</h1>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        See how each DSO client&apos;s rollout is progressing.
      </p>

      <AdminProjectsList initialProjects={projects} />
    </div>
  );
}
